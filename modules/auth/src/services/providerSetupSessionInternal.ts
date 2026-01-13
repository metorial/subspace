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
  ProviderDeployment,
  ProviderOAuthSetup,
  ProviderSetupSession,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { env } from '../env';
import { providerSetupSessionUpdatedQueue } from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigService } from './providerAuthConfig';
import { providerOAuthSetupService } from './providerOAuthSetup';
import { providerSetupSessionInclude } from './providerSetupSession';

let updateLock = createLock({
  name: 'auth/providerSetupSession/service',
  redisUrl: env.service.REDIS_URL
});

class providerSetupSessionInternalServiceImpl {
  async getProviderSetupSessionByClientSecret(d: { clientSecret: string }) {
    let providerSetupSession = await db.providerSetupSession.findFirst({
      where: {
        clientSecret: d.clientSecret,
        status: { notIn: ['archived', 'deleted'] }
      },
      include: providerSetupSessionInclude
    });
    if (!providerSetupSession) throw new ServiceError(notFoundError('provider.auth_session'));

    return providerSetupSession;
  }

  async updateProviderSetupSessionInternal(d: {
    providerSetupSession: ProviderSetupSession;
    input: {
      authConfigInput: Record<string, any>;
      configInput?: Record<string, any>;
    };
    context: {
      ip: string;
      ua: string;
    };
  }) {
    if (d.providerSetupSession.status == 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update a completed provider auth session'
        })
      );
    }
    if (d.providerSetupSession.expiresAt < new Date()) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an expired provider auth session'
        })
      );
    }

    if (d.providerSetupSession.type === 'auth_and_config' && !d.input.configInput) {
      throw new ServiceError(
        badRequestError({
          message: 'Config input is required for auth_and_config session type'
        })
      );
    }

    return updateLock.usingLock(d.providerSetupSession.id, () =>
      withTransaction(async db => {
        let currentSession = await db.providerSetupSession.findUniqueOrThrow({
          where: {
            oid: d.providerSetupSession.oid
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

        let setAuthConfigInner = await this.setAuthConfig({
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
            config: d.input.authConfigInput
          },
          import: {
            ip: d.context.ip,
            ua: d.context.ua
          }
        });

        let setConfigInner = d.input.configInput
          ? await this.setConfig({
              tenant: currentSession.tenant,
              solution: currentSession.solution,
              provider: currentSession.provider,
              providerDeployment: currentSession.deployment ?? undefined,
              input: {
                name: currentSession.name ?? undefined,
                description: currentSession.description ?? undefined,
                metadata: currentSession.metadata ?? undefined,
                config: d.input.configInput
              }
            })
          : {};

        let session = await db.providerSetupSession.update({
          where: { oid: d.providerSetupSession.oid },
          data: {
            ...setAuthConfigInner,
            ...setConfigInner
          }
        });

        if (session.authConfigOid) {
          await db.providerSetupSessionEvent.createMany({
            data: {
              ...getId('providerSetupSessionEvent'),
              type: 'auth_config_set',
              sessionOid: session.oid
            }
          });
        }

        if (session.configOid) {
          await db.providerSetupSessionEvent.createMany({
            data: {
              ...getId('providerSetupSessionEvent'),
              type: 'config_set',
              sessionOid: session.oid
            }
          });
        }

        session = await this.evaluate({
          session: session,
          context: { ip: d.context.ip, ua: d.context.ua }
        });

        await addAfterTransactionHook(() =>
          providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: session.id })
        );

        return session;
      })
    );
  }

  async setAuthConfig(d: {
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

  async setConfig(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config: Record<string, any>;
    };
  }) {
    let config = await providerConfigService.createProviderConfig({
      tenant: d.tenant,
      solution: d.solution,
      provider: d.provider,
      providerDeployment: d.providerDeployment,
      input: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        isEphemeral: true,
        config: { type: 'inline', data: d.input.config }
      }
    });

    return {
      configOid: config.oid,
      deploymentOid: config.deploymentOid
    };
  }

  async oauthSetupCompleted(d: {
    session: ProviderSetupSession;
    setup: ProviderOAuthSetup;
    context: { ip: string; ua: string };
  }) {
    return withTransaction(async db => {
      if (
        d.session.status == 'completed' ||
        d.session.status == 'archived' ||
        d.session.status == 'deleted' ||
        d.session.status == 'expired'
      )
        return d.setup;

      if (d.setup.status == 'completed') {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        await db.providerSetupSessionEvent.createMany({
          data: [
            {
              ...getId('providerSetupSessionEvent'),
              type: 'oauth_setup_completed',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            },
            {
              ...getId('providerSetupSessionEvent'),
              type: 'auth_config_set',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            }
          ]
        });

        d.setup = await db.providerOAuthSetup.update({
          where: { oid: d.setup.oid },
          data: { redirectUrl: d.session.redirectUrl }
        });
      } else {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            status: 'failed',
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        await db.providerSetupSessionEvent.createMany({
          data: {
            ...getId('providerSetupSessionEvent'),
            type: 'oauth_setup_failed',
            ip: d.context.ip,
            ua: d.context.ua,
            sessionOid: d.session.oid,
            setupOid: d.setup.oid
          }
        });
      }

      await this.evaluate({
        session: d.session,
        context: { ip: d.context.ip, ua: d.context.ua }
      });

      addAfterTransactionHook(async () =>
        providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: d.session.id })
      );

      return d.setup;
    });
  }

  async evaluate(d: { session: ProviderSetupSession; context: { ip: string; ua: string } }) {
    if (
      d.session.status == 'completed' ||
      d.session.status == 'archived' ||
      d.session.status == 'deleted' ||
      d.session.status == 'expired'
    )
      return d.session;

    return withTransaction(async db => {
      let result = d.session;

      let hasAuthConfig = d.session.authConfigOid !== null;
      let hasConfig = d.session.configOid !== null;

      if (d.session.type == 'auth_only') {
        if (hasAuthConfig) {
          result = await db.providerSetupSession.update({
            where: { oid: d.session.oid },
            data: { status: 'completed' }
          });

          await db.providerSetupSessionEvent.createMany({
            data: [
              {
                ...getId('providerSetupSessionEvent'),
                type: 'completed',
                sessionOid: d.session.oid,
                ip: d.context.ip,
                ua: d.context.ua
              }
            ]
          });
        }
      }

      if (d.session.type == 'auth_and_config') {
        if (hasAuthConfig && hasConfig) {
          result = await db.providerSetupSession.update({
            where: { oid: d.session.oid },
            data: { status: 'completed' }
          });

          await db.providerSetupSessionEvent.createMany({
            data: {
              ...getId('providerSetupSessionEvent'),
              type: 'completed',
              sessionOid: d.session.oid,
              ip: d.context.ip,
              ua: d.context.ua
            }
          });
        }
      }

      return result;
    });
  }
}

export let providerSetupSessionInternalService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionInternalServiceImpl()
).build();
