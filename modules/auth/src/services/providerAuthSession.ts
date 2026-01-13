import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  ID,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthSession,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { addMinutes } from 'date-fns';
import {
  providerAuthSessionCreatedQueue,
  providerAuthSessionUpdatedQueue
} from '../queues/lifecycle/providerAuthSession';
import { providerAuthConfigInclude } from './providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerAuthSessionInternalService } from './providerAuthSessionInternal';

let include = {
  authConfig: { include: providerAuthConfigInclude },
  deployment: true,
  provider: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true
};

export let providerAuthSessionInclude = include;

class providerAuthSessionServiceImpl {
  async listProviderAuthSessions(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthSession.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid
            },
            include
          })
      )
    );
  }

  async getProviderAuthSessionById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthSessionId: string;
  }) {
    let providerAuthSession = await db.providerAuthSession.findFirst({
      where: {
        id: d.providerAuthSessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthSession)
      throw new ServiceError(notFoundError('provider.auth_session', d.providerAuthSessionId));

    return providerAuthSession;
  }

  async createProviderAuthSession(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    credentials?: ProviderAuthCredentials;
    input: {
      name: string;
      authMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      config?: Record<string, any>;
      expiresAt?: Date;
      redirectUrl?: string;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerDeployment);

    if (d.providerDeployment && d.providerDeployment.providerOid != d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId
        });

      if (d.credentials && authMethod.type != 'oauth') d.credentials = undefined;
      if (authMethod.type == 'oauth' && !d.credentials) {
        let defaultCredentials = await db.providerAuthCredentials.findFirst({
          where: {
            providerOid: d.provider.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            isDefault: true
          }
        });

        if (!defaultCredentials) {
          throw new ServiceError(
            badRequestError({
              message: 'No default provider auth credentials found for oauth method',
              code: 'missing_oauth_credentials'
            })
          );
        }

        d.credentials = defaultCredentials;
      }

      let expiresAt = d.input.expiresAt ?? addMinutes(new Date(), 30);

      return withTransaction(async db => {
        let inner: Partial<ProviderAuthSession> & { authMethodOid: bigint } = {
          authMethodOid: authMethod.oid
        };

        if (d.input.config) {
          inner = await providerAuthSessionInternalService.setConfig({
            tenant: d.tenant,
            solution: d.solution,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            credentials: d.credentials,
            authMethod: authMethod,
            expiresAt,
            input: {
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              config: d.input.config
            },
            import: {
              ip: d.import.ip,
              ua: d.import.ua
            }
          });
        }

        let session = await db.providerAuthSession.create({
          data: {
            ...getId('providerAuthSession'),
            ...inner,

            clientSecret: await ID.generateId('providerAuthSession_clientSecret'),

            status: inner.authConfigOid ? 'completed' : 'pending',

            name: d.input.name?.trim() || undefined,
            description: d.input.description?.trim() || undefined,
            metadata: d.input.metadata,

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            providerOid: d.provider.oid,

            expiresAt
          },
          include
        });

        await db.providerAuthSessionEvent.createMany({
          data: {
            ...getId('providerAuthSessionEvent'),
            type: 'created',
            sessionOid: session.oid
          }
        });
        if (session.authConfigOid) {
          await db.providerAuthSessionEvent.createMany({
            data: {
              ...getId('providerAuthSessionEvent'),
              type: 'config_created',
              sessionOid: session.oid
            }
          });
        }
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
          providerAuthSessionCreatedQueue.add({ providerAuthSessionId: session.id })
        );

        return session;
      });
    });
  }

  async updateProviderAuthSession(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthSession: ProviderAuthSession;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let config = await db.providerAuthSession.update({
        where: {
          oid: d.providerAuthSession.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthSession.name,
          description: d.input.description ?? d.providerAuthSession.description,
          metadata: d.input.metadata ?? d.providerAuthSession.metadata
        },
        include
      });

      await addAfterTransactionHook(() =>
        providerAuthSessionUpdatedQueue.add({ providerAuthSessionId: config.id })
      );

      return config;
    });
  }
}

export let providerAuthSessionService = Service.create(
  'providerAuthSession',
  () => new providerAuthSessionServiceImpl()
).build();
