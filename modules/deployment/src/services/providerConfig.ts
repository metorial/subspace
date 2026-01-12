import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
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
import { providerDeploymentConfigPairInternalService } from '@metorial-subspace/module-provider-internal';
import { getBackend } from '@metorial-subspace/provider';
import {
  providerConfigCreatedQueue,
  providerConfigUpdatedQueue
} from '../queues/lifecycle/providerConfig';

let include = {};

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
      throw new ServiceError(notFoundError('provider_config', d.providerConfigId));

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
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral: boolean;
      isDefault: boolean;
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
    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let ids = getId('providerConfig');

      let data = {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,

        isEphemeral: d.input.isEphemeral,
        isDefault: d.input.isDefault,
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

              slateInstanceOid: parentConfig.slateInstanceOid
            },
            include
          });
        }

        let inner = await backend.deployment.createProviderConfig({
          tenant: d.tenant,
          id: ids.id,
          provider: d.provider,
          providerVariant: d.provider.defaultVariant!,
          deployment: d.providerDeployment ?? null,
          config: d.input.config
        });

        return await db.providerConfig.create({
          data: {
            ...ids,
            ...data,

            slateInstanceOid: inner.slateInstance?.oid
          },
          include
        });
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
