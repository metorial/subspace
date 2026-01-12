import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderAuthConfig,
  ProviderAuthMethod,
  ProviderAuthMethodType,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { ProviderAuthConfigCreateRes } from '@metorial-subspace/provider-utils';
import {
  providerAuthConfigCreatedQueue,
  providerAuthConfigUpdatedQueue
} from '../queues/lifecycle/providerAuthConfig';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authMethod: true
};

class providerAuthConfigServiceImpl {
  async listProviderAuthConfigs(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              isEphemeral: false
            },
            include
          })
      )
    );
  }

  async getProviderAuthConfigById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthConfigId: string;
  }) {
    let providerAuthConfig = await db.providerAuthConfig.findFirst({
      where: {
        id: d.providerAuthConfigId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthConfig)
      throw new ServiceError(notFoundError('provider_config', d.providerAuthConfigId));

    return providerAuthConfig;
  }

  async updateProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthConfig: ProviderAuthConfig;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerAuthConfig);

    return withTransaction(async db => {
      let config = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthConfig.name,
          description: d.input.description ?? d.providerAuthConfig.description,
          metadata: d.input.metadata ?? d.providerAuthConfig.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthConfigUpdatedQueue.add({ providerAuthConfigId: config.id })
      );

      return config;
    });
  }

  async createProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
      authMethodId: string;

      config: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerDeployment);

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default provider configs must be associated with a deployment',
          code: 'default_config_requires_deployment'
        })
      );
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let version = await providerDeploymentInternalService.getCurrentVersionOptional({
        provider: d.provider,
        deployment: d.providerDeployment
      });
      if (!version.specificationOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider has not been discovered'
          })
        );
      }

      let authMethod = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: version.specificationOid,
          OR: [
            { id: d.input.authMethodId },
            { specId: d.input.authMethodId },
            { specUniqueIdentifier: d.input.authMethodId },
            { key: d.input.authMethodId },
            { callableId: d.input.authMethodId },

            ...(ProviderAuthMethodType[
              d.input.authMethodId as keyof typeof ProviderAuthMethodType
            ]
              ? [{ type: d.input.authMethodId as any }]
              : [])
          ]
        }
      });
      if (!authMethod) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid auth method for provider',
            code: 'invalid_auth_method'
          })
        );
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let backendProviderAuthConfig = await backend.auth.createProviderAuthConfig({
        tenant: d.tenant,
        provider: d.provider,
        providerVersion: version,
        authMethod,
        input: d.input.config
      });

      return await this.createProviderAuthConfigInternal({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        input: d.input,
        authMethod,
        backendProviderAuthConfig
      });
    });
  }

  async createProviderAuthConfigInternal(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider;
    providerDeployment?: ProviderDeployment;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
    };

    authMethod: ProviderAuthMethod;
    backendProviderAuthConfig: ProviderAuthConfigCreateRes;
  }) {
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.backendProviderAuthConfig.slateAuthConfig);

    return withTransaction(async db => {
      let providerAuthConfig = await db.providerAuthConfig.create({
        data: {
          ...getId('providerAuthConfig'),

          type: 'manual',

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          providerOid: d.provider.oid,
          authMethodOid: d.authMethod.oid,
          deploymentOid: d.providerDeployment?.oid,

          slateAuthConfigOid: d.backendProviderAuthConfig.slateAuthConfig?.oid
        },
        include
      });

      if (providerAuthConfig.isDefault && d.providerDeployment) {
        if (d.providerDeployment.defaultAuthConfigOid) {
          await db.providerAuthConfig.updateMany({
            where: {
              deploymentOid: d.providerDeployment.oid,
              isDefault: true
            },
            data: { isDefault: false }
          });
        }

        await db.providerDeployment.update({
          where: { oid: d.providerDeployment.oid },
          data: { defaultAuthConfigOid: providerAuthConfig.oid }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigCreatedQueue.add({ providerAuthConfigId: providerAuthConfig.id })
      );

      return providerAuthConfig;
    });
  }
}

export let providerAuthConfigService = Service.create(
  'providerAuthConfig',
  () => new providerAuthConfigServiceImpl()
).build();
