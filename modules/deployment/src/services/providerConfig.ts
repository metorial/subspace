import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import {
  providerConfigCreatedQueue,
  providerConfigUpdatedQueue
} from '../queues/lifecycle/providerConfig';

let include = {
  provider: true,
  deployment: true,
  specification: true,
  fromVault: {
    include: {
      deployment: true
    }
  }
};

class providerConfigServiceImpl {
  async listProviderConfigs(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              isForVault: false,
              isEphemeral: false
            },
            include
          })
      )
    );
  }

  async getProviderConfigById(d: {
    tenant: Tenant;
    solution: Solution;
    providerConfigId: string;
  }) {
    let providerConfig = await db.providerConfig.findFirst({
      where: {
        id: d.providerConfigId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerConfig)
      throw new ServiceError(notFoundError('provider.config', d.providerConfigId));

    return providerConfig;
  }

  async createProviderConfig(d: {
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
      isEphemeral?: boolean;
      isDefault?: boolean;
      isForVault?: boolean;

      config:
        | {
            type: 'vault';
            vault: ProviderConfigVault;
          }
        | {
            type: 'inline';
            data: Record<string, any>;
          };
    };
  }) {
    checkTenant(d, d.providerDeployment);
    if (d.input.config.type == 'vault') checkTenant(d, d.input.config.vault);

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

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let ids = getId('providerConfig');

      let data = {
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,

        isEphemeral: !!d.input.isEphemeral,
        isDefault: !!d.input.isDefault,
        isForVault: !!d.input.isForVault,

        tenantOid: d.tenant.oid,
        providerOid: d.provider.oid,
        solutionOid: d.solution.oid,

        specificationDiscoveryStatus: 'discovering' as const,
        providerDeploymentOid: d.providerDeployment?.oid
      };

      let config = await (async () => {
        if (d.input.config.type == 'vault') {
          if (
            d.input.config.vault.deploymentOid &&
            d.providerDeployment &&
            d.input.config.vault.deploymentOid != d.providerDeployment.oid
          ) {
            throw new ServiceError(
              preconditionFailedError({
                message: 'Vault is locked to a different deployment',
                code: 'deployment_lock_mismatch'
              })
            );
          }

          let parentConfig = await db.providerConfig.findFirstOrThrow({
            where: {
              oid: d.input.config.vault.configOid,
              tenantOid: d.tenant.oid
            }
          });

          return await db.providerConfig.create({
            data: {
              ...ids,
              ...data,

              parentConfigOid: parentConfig.oid,
              fromVaultOid: d.input.config.vault.oid,

              deploymentOid: d.providerDeployment?.oid ?? d.input.config.vault.deploymentOid,
              specificationOid: parentConfig.specificationOid,

              slateInstanceOid: parentConfig.slateInstanceOid
            },
            include
          });
        }

        let version = await providerDeploymentInternalService.getCurrentVersionOptional({
          provider: d.provider,
          deployment: d.providerDeployment
        });
        if (!version.specificationOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot create config without a discovered specification'
            })
          );
        }

        let inner = await backend.deployment.createProviderConfig({
          tenant: d.tenant,
          id: ids.id,
          provider: d.provider,
          providerVariant: d.provider.defaultVariant!,
          deployment: d.providerDeployment ?? null,
          config: d.input.config
        });

        let config = await db.providerConfig.create({
          data: {
            ...ids,
            ...data,

            deploymentOid: d.providerDeployment?.oid,
            slateInstanceOid: inner.slateInstance?.oid,
            specificationOid: version.specificationOid
          },
          include
        });

        if (d.input.isDefault && d.providerDeployment) {
          if (d.providerDeployment.defaultConfigOid) {
            await db.providerConfig.updateMany({
              where: {
                OR: [
                  { oid: d.providerDeployment.defaultConfigOid },
                  { deploymentOid: d.providerDeployment.oid }
                ]
              },
              data: { isDefault: false }
            });
          }

          await db.providerDeployment.updateMany({
            where: { oid: d.providerDeployment.oid },
            data: { defaultConfigOid: config.oid }
          });
        }

        return config;
      })();

      if (d.providerDeployment) {
        await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair({
          deployment: d.providerDeployment,
          config
        });
      }

      await addAfterTransactionHook(async () =>
        providerConfigCreatedQueue.add({ providerConfigId: config.id })
      );

      return config;
    });
  }

  async updateProviderConfig(d: {
    tenant: Tenant;
    solution: Solution;
    providerConfig: ProviderConfig;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerConfig);

    return withTransaction(async db => {
      let config = await db.providerConfig.update({
        where: {
          oid: d.providerConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerConfig.name,
          description: d.input.description ?? d.providerConfig.description,
          metadata: d.input.metadata ?? d.providerConfig.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigUpdatedQueue.add({ providerConfigId: config.id })
      );

      return config;
    });
  }
}

export let providerConfigService = Service.create(
  'providerConfig',
  () => new providerConfigServiceImpl()
).build();
