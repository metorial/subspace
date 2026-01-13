import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderAuthSession,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerAuthSessionUpdatedQueue } from '../queues/lifecycle/providerAuthSession';
import { providerAuthConfigService } from './providerAuthConfig';
import { providerAuthSessionInclude } from './providerAuthSession';
import { providerOAuthSetupService } from './providerOAuthSetup';

let updateLock = createLock({
  name: 'auth/providerAuthSession/service',
  redisUrl: process.env.REDIS_URL!
});

class providerAuthSessionInternalServiceImpl {
  async getProviderAuthSessionByClientSecret(d: { clientSecret: string }) {
    let providerAuthSession = await db.providerAuthSession.findFirst({
      where: {
        clientSecret: d.clientSecret,
        status: { notIn: ['archived', 'deleted'] }
      },
      include: providerAuthSessionInclude
    });
    if (!providerAuthSession) throw new ServiceError(notFoundError('provider.auth_session'));

    return providerAuthSession;
  }

  async updateProviderAuthSessionInternal(d: {
    providerAuthSession: ProviderAuthSession;
    input: {
      config: Record<string, any>;
    };
    context: {
      ip: string;
      ua: string;
    };
  }) {
    if (d.providerAuthSession.status == 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update a completed provider auth session'
        })
      );
    }
    if (d.providerAuthSession.expiresAt < new Date()) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an expired provider auth session'
        })
      );
    }

    return updateLock.usingLock(d.providerAuthSession.id, () =>
      withTransaction(async db => {
        let currentSession = await db.providerAuthSession.findUniqueOrThrow({
          where: {
            oid: d.providerAuthSession.oid
          },
          include: {
            tenant: true,
            solution: true,
            authCredentials: true,
            provider: { include: { defaultVariant: true } },
            authMethod: true,
            deployment: {
              include: {
                provider: true,
                providerVariant: true,
                lockedVersion: true
              }
            }
          }
        });
        if (currentSession.status == 'completed' || currentSession.authConfigOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update a completed provider auth session'
            })
          );
        }

        let inner = await this.setConfig({
          tenant: currentSession.tenant,
          solution: currentSession.solution,
          provider: currentSession.provider,
          providerDeployment: currentSession.deployment ?? undefined,
          credentials: currentSession.authCredentials ?? undefined,
          authMethod: currentSession.authMethod,
          expiresAt: currentSession.expiresAt,
          input: {
            name: currentSession.name ?? undefined,
            description: currentSession.description ?? undefined,
            metadata: currentSession.metadata ?? undefined,
            config: d.input.config
          },
          import: {
            ip: d.context.ip,
            ua: d.context.ua
          }
        });

        let session = await db.providerAuthSession.update({
          where: { oid: d.providerAuthSession.oid },
          data: {
            ...inner,
            status: inner.authConfigOid ? 'completed' : undefined
          }
        });

        await db.providerAuthSessionEvent.createMany({
          data: {
            ...getId('providerAuthSessionEvent'),
            type: 'config_created',
            sessionOid: session.oid
          }
        });
        if (session.status == 'completed') {
          await db.providerAuthSessionEvent.createMany({
            data: {
              ...getId('providerAuthSessionEvent'),
              type: 'completed',
              sessionOid: session.oid
            }
          });
        }

        await addAfterTransactionHook(() =>
          providerAuthSessionUpdatedQueue.add({ providerAuthSessionId: session.id })
        );

        return session;
      })
    );
  }

  async setConfig(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    credentials?: ProviderAuthCredentials;
    authMethod: ProviderAuthMethod;
    expiresAt: Date;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
    };
  }) {
    if (d.authMethod.type == 'oauth') {
      if (!d.credentials) {
        throw new ServiceError(
          badRequestError({
            message: 'No provider auth credentials provided for oauth method',
            code: 'missing_oauth_credentials'
          })
        );
      }

      let setup = await providerOAuthSetupService.createProviderOAuthSetup({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        credentials: d.credentials!,
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          config: d.input.config,
          authMethodId: d.authMethod.id,
          expiresAt: d.expiresAt
        }
      });

      return {
        oauthSetupOid: setup.oid,
        deploymentOid: setup.deploymentOid,
        authConfigOid: setup.authConfigOid,
        authMethodOid: setup.authMethodOid,
        authCredentialsOid: setup.authCredentialsOid
      };
    } else {
      let config = await providerAuthConfigService.createProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        import: d.import,
        source: 'auth_session',
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          isEphemeral: true,
          config: d.input.config,
          authMethodId: d.authMethod.id
        }
      });

      return {
        authConfigOid: config.oid,
        deploymentOid: config.deploymentOid,
        authMethodOid: config.authMethodOid,
        authCredentialsOid: config.authCredentialsOid
      };
    }
  }
}

export let providerAuthSessionInternalService = Service.create(
  'providerAuthSession',
  () => new providerAuthSessionInternalServiceImpl()
).build();
