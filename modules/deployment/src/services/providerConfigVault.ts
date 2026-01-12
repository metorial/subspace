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
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  providerConfigVaultCreatedQueue,
  providerConfigVaultUpdatedQueue
} from '../queues/lifecycle/providerConfigVault';
import { providerConfigService } from './providerConfig';

let include = {
  provider: true,
  deployment: true
};

class providerConfigVaultServiceImpl {
  async listProviderConfigVaults(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConfigVault.findMany({
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

  async getProviderConfigVaultById(d: {
    tenant: Tenant;
    solution: Solution;
    providerConfigVaultId: string;
  }) {
    let providerConfigVault = await db.providerConfigVault.findFirst({
      where: {
        id: d.providerConfigVaultId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerConfigVault)
      throw new ServiceError(notFoundError('provider.config_vault', d.providerConfigVaultId));

    return providerConfigVault;
  }

  async createProviderConfigVault(d: {
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
      config: {
        type: 'inline';
        data: Record<string, any>;
      };
    };
  }) {
    checkTenant(d, d.providerDeployment);

    return await withTransaction(async db => {
      let config = await providerConfigService.createProviderConfig({
        tenant: d.tenant,
        solution: d.solution,
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
          solutionOid: d.solution.oid,
          deploymentOid: d.providerDeployment?.oid
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerConfigVaultCreatedQueue.add({ providerConfigVaultId: config.id })
      );

      return vault;
    });
  }

  async updateProviderConfigVault(d: {
    tenant: Tenant;
    solution: Solution;
    providerConfigVault: ProviderConfigVault;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerConfigVault);

    return withTransaction(async db => {
      let vault = await db.providerConfigVault.update({
        where: {
          oid: d.providerConfigVault.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
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
