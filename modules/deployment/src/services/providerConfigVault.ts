import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  providerConfigVaultCreatedQueue,
  providerConfigVaultUpdatedQueue
} from '../queues/lifecycle/providerConfigVault';
import { providerConfigService } from './providerConfig';

let include = {};

class providerConfigVaultServiceImpl {
  async listProviderConfigVaults(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConfigVault.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid
            },
            include
          })
      )
    );
  }

  async getProviderConfigVaultById(d: { tenant: Tenant; providerConfigVaultId: string }) {
    let providerConfigVault = await db.providerConfigVault.findFirst({
      where: {
        id: d.providerConfigVaultId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!providerConfigVault)
      throw new ServiceError(notFoundError('provider_config_vault', d.providerConfigVaultId));

    return providerConfigVault;
  }

  async createProviderConfigVault(d: {
    tenant: Tenant;
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
      config: {
        type: 'inline';
        data: Record<string, any>;
      };
    };
  }) {
    return await withTransaction(async db => {
      let config = await providerConfigService.createProviderConfig({
        tenant: d.tenant,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        input: {
          name: `Vault Config for ${d.input.name}`,
          isEphemeral: true,
          isForVault: true,
          isDefault: false,
          config: d.input.config
        }
      });

      let vault = await db.providerConfigVault.create({
        data: {
          ...getId('providerConfigVault'),
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          tenantOid: d.tenant.oid,
          configOid: config.oid,
          providerOid: d.provider.oid,
          deploymentOid: d.providerDeployment?.oid
        }
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultCreatedQueue.add({ providerConfigVaultId: config.id })
      );

      return vault;
    });
  }

  async updateProviderConfigVault(d: {
    tenant: Tenant;
    providerConfigVault: ProviderConfigVault;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid
        },
        data: {
          name: d.input.name ?? d.providerConfigVault.name,
          description: d.input.description ?? d.providerConfigVault.description,
          metadata: d.input.metadata ?? d.providerConfigVault.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultUpdatedQueue.add({ providerConfigVaultId: vault.id })
      );

      return vault;
    });
  }
}

export let providerConfigVaultService = Service.create(
  'providerConfigVault',
  () => new providerConfigVaultServiceImpl()
).build();
