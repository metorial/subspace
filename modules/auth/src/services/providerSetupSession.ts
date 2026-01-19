import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Brand,
  db,
  getId,
  ID,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderDeployment,
  type ProviderSetupSession,
  type ProviderSetupSessionStatus,
  type ProviderSetupSessionType,
  type ProviderSetupSessionUiMode,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviderAuthMethods,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { addMinutes } from 'date-fns';
import {
  providerSetupSessionCreatedQueue,
  providerSetupSessionUpdatedQueue
} from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigInclude } from './providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerSetupSessionInternalService } from './providerSetupSessionInternal';

let include = {
  authConfig: { include: providerAuthConfigInclude },
  deployment: true,
  provider: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true,
  config: {
    include: {
      deployment: true,
      specification: { omit: { value: true } },
      fromVault: { include: { deployment: true } }
    }
  }
};

export let providerSetupSessionInclude = include;

class providerSetupSessionServiceImpl {
  async listProviderSetupSessions(d: {
    tenant: Tenant;
    solution: Solution;

    status?: ProviderSetupSessionStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerAuthMethodIds?: string[];
    providerDeploymentIds?: string[];
    providerAuthConfigIds?: string[];
    providerAuthCredentialsIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      d,
      d.providerAuthCredentialsIds
    );
    let authMethods = await resolveProviderAuthMethods(d, d.providerAuthMethodIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerSetupSession.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                authCredentials ? { authCredentialsOid: authCredentials.in } : undefined!,
                authMethods ? { authMethodOid: authMethods.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderSetupSessionById(d: {
    tenant: Tenant;
    solution: Solution;
    providerSetupSessionId: string;
    allowDeleted?: boolean;
  }) {
    let providerSetupSession = await db.providerSetupSession.findFirst({
      where: {
        id: d.providerSetupSessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerSetupSession)
      throw new ServiceError(
        notFoundError('provider.setup_session', d.providerSetupSessionId)
      );

    return providerSetupSession;
  }

  async createProviderSetupSession(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    credentials?: ProviderAuthCredentials;
    brand?: Brand;
    input: {
      name: string;
      authMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      expiresAt?: Date;
      redirectUrl?: string;
      type: ProviderSetupSessionType;
      uiMode: ProviderSetupSessionUiMode;

      authConfigInput?: Record<string, any>;
      configInput?: Record<string, any>;
    };
    import: {
      ip: string;
      ua: string;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerDeployment);

    checkDeletedRelation(d.providerDeployment);
    checkDeletedRelation(d.credentials);

    if (d.providerDeployment && d.providerDeployment.providerOid !== d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }

    if (d.input.type === 'config_only' && d.input.authConfigInput) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth config input provided for config_only session type'
        })
      );
    }
    if (d.input.type === 'auth_only' && d.input.configInput) {
      throw new ServiceError(
        badRequestError({
          message: 'Config input provided for auth_only session type'
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
          authMethodId: d.input.authMethodId ?? (d.credentials ? 'oauth' : undefined)
        });

      if (d.credentials && authMethod.type !== 'oauth') d.credentials = undefined;
      if (authMethod.type === 'oauth' && !d.credentials) {
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

      let inner: Partial<ProviderSetupSession> & { authMethodOid: bigint } = {
        authMethodOid: authMethod.oid
      };

      if (d.input.authConfigInput && d.input.type !== 'config_only') {
        let authConfigInner =
          await providerSetupSessionInternalService.createProviderAuthConfig({
            tenant: d.tenant,
            solution: d.solution,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            credentials: d.credentials,
            authMethod,
            expiresAt,
            input: {
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              config: d.input.authConfigInput
            },
            import: {
              ip: d.import.ip,
              ua: d.import.ua
            }
          });

        inner = { ...inner, ...authConfigInner };
      }

      if (d.input.configInput && d.input.type !== 'auth_only') {
        let configInner = await providerSetupSessionInternalService.createProviderConfig({
          tenant: d.tenant,
          solution: d.solution,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          input: {
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata,
            config: d.input.configInput
          }
        });

        inner = { ...inner, ...configInner };
      }

      let session = await db.providerSetupSession.create({
        data: {
          ...getId('providerSetupSession'),
          ...inner,

          clientSecret: await ID.generateId('providerSetupSession_clientSecret'),

          type: d.input.type,
          uiMode: d.input.uiMode,
          status: inner.authConfigOid ? 'completed' : 'pending',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          providerOid: d.provider.oid,
          brandOid: d.brand?.oid,

          expiresAt
        },
        include
      });

      await db.providerSetupSessionEvent.createMany({
        data: {
          ...getId('providerSetupSessionEvent'),
          type: 'created',
          sessionOid: session.oid
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

      await providerSetupSessionInternalService.evaluate({
        session,
        context: { ip: d.import.ip, ua: d.import.ua }
      });

      await addAfterTransactionHook(() =>
        providerSetupSessionCreatedQueue.add({ providerSetupSessionId: session.id })
      );

      return await db.providerSetupSession.findUniqueOrThrow({
        where: { oid: session.oid },
        include
      });
    });
  }

  async updateProviderSetupSession(d: {
    tenant: Tenant;
    solution: Solution;
    providerSetupSession: ProviderSetupSession;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkDeletedEdit(d.providerSetupSession, 'update');

    return withTransaction(async db => {
      let config = await db.providerSetupSession.update({
        where: {
          oid: d.providerSetupSession.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerSetupSession.name,
          description: d.input.description ?? d.providerSetupSession.description,
          metadata: d.input.metadata ?? d.providerSetupSession.metadata
        },
        include
      });

      await addAfterTransactionHook(() =>
        providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: config.id })
      );

      return config;
    });
  }
}

export let providerSetupSessionService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionServiceImpl()
).build();
