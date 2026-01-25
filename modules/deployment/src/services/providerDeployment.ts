import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  ID,
  type Provider,
  type ProviderConfigVault,
  type ProviderDeployment,
  type ProviderDeploymentStatus,
  type ProviderVariant,
  type ProviderVersion,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders,
  resolveProviderVersions
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import {
  providerDeploymentCreatedQueue,
  providerDeploymentUpdatedQueue
} from '../queues/lifecycle/providerDeployment';
import { providerConfigService } from './providerConfig';

let include = {
  provider: true,
  defaultConfig: true,
  providerVariant: true,
  lockedVersion: { include: { specification: true } }
};

let defaultLock = createLock({
  name: 'dep/pdep/def/lock',
  redisUrl: env.service.REDIS_URL
});

class providerDeploymentServiceImpl {
  async listProviderDeployments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: ProviderDeploymentStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let versions = await resolveProviderVersions(d, d.providerVersionIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: voyagerSource.id,
          indexId: voyagerIndex.providerDeployment.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerDeployment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                versions ? { lockedVersionOid: versions.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderDeploymentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeploymentId: string;
    allowDeleted?: boolean;
  }) {
    let providerDeployment = await db.providerDeployment.findFirst({
      where: {
        id: d.providerDeploymentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!providerDeployment)
      throw new ServiceError(notFoundError('provider.deployment', d.providerDeploymentId));

    return providerDeployment;
  }

  async createProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    lockedVersion?: ProviderVersion;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;

      config:
        | {
            type: 'none';
          }
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
    checkDeletedRelation(d.provider, { allowEphemeral: d.input.isEphemeral });

    if (d.input.config.type === 'vault') {
      checkTenant(d, d.input.config.vault);
      checkDeletedRelation(d.input.config.vault, { allowEphemeral: d.input.isEphemeral });
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let environmentProvider = await db.environmentProvider.findFirst({
        where: { tenantOid: d.tenant.oid, providerOid: d.provider.oid }
      });
      if (!environmentProvider) {
        await db.environmentProvider.upsert({
          where: {
            tenantOid_providerOid: {
              tenantOid: d.tenant.oid,
              providerOid: d.provider.oid
            }
          },
          create: {
            oid: snowflake.nextId(),
            id: `${ID.idPrefixes.environmentProvider}_1${d.tenant.oid.toString(36).padStart(16, '0')}${d.environment.oid.toString(36).padStart(16, '0')}${d.provider.oid.toString(36).padStart(16, '0')}`,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid
          },
          update: {}
        });
      }

      let backend = await getBackend({ entity: d.provider.defaultVariant });

      let ids = getId('providerDeployment');

      let inner = await backend.deployment.createProviderDeployment({
        tenant: d.tenant,
        id: ids.id,
        provider: d.provider,
        providerVariant: d.provider.defaultVariant,
        lockedVersion: d.lockedVersion ?? null
      });

      let providerDeployment = await db.providerDeployment.create({
        data: {
          ...ids,

          status: 'active',

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid,
          providerVariantOid: d.provider.defaultVariant.oid,
          lockedVersionOid: d.lockedVersion?.oid,

          specificationDiscoveryStatus: 'discovering'
        },
        include: {
          provider: true,
          providerVariant: true,
          lockedVersion: true
        }
      });

      if (d.input.config.type !== 'none') {
        await providerConfigService.createProviderConfig({
          tenant: d.tenant,
          providerDeployment,
          provider: d.provider,
          solution: d.solution,
          environment: d.environment,
          input: {
            name: `Default Config for ${d.input.name}`,
            isEphemeral: d.input.isEphemeral,
            config: d.input.config,
            metadata: d.input.metadata,
            isDefault: true
          }
        });
      }

      if (providerDeployment.isDefault) {
        await db.providerDeployment.updateMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            providerOid: d.provider.oid,
            oid: { not: providerDeployment.oid },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      await addAfterTransactionHook(async () =>
        providerDeploymentCreatedQueue.add({ providerDeploymentId: providerDeployment.id })
      );

      return await db.providerDeployment.findFirstOrThrow({
        where: { oid: providerDeployment.oid },
        include
      });
    });
  }

  async ensureDefaultProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
  }) {
    let currentDefault = await this.getDefaultProviderDeployment(d);
    if (currentDefault) return currentDefault;

    return await defaultLock.usingLock(d.provider.id, async () => {
      let currentDefault = await this.getDefaultProviderDeployment(d);
      if (currentDefault) return currentDefault;

      return await this.createProviderDeployment({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        input: {
          name: `Default Deployment for ${d.provider.name}`,
          description: 'Auto-created by Metorial',
          config: { type: 'none' },
          isDefault: true
        }
      });
    });
  }

  async updateProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: ProviderDeployment;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkDeletedEdit(d.providerDeployment, 'update');

    return withTransaction(async db => {
      let providerDeployment = await db.providerDeployment.update({
        where: {
          oid: d.providerDeployment.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.providerDeployment.name,
          description: d.input.description ?? d.providerDeployment.description,
          metadata: d.input.metadata ?? d.providerDeployment.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerDeploymentUpdatedQueue.add({ providerDeploymentId: providerDeployment.id })
      );

      return providerDeployment;
    });
  }

  private async getDefaultProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider;
  }) {
    return await withTransaction(
      db =>
        db.providerDeployment.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid,
            isDefault: true
          },
          include
        }),
      { ifExists: true }
    );
  }
}

export let providerDeploymentService = Service.create(
  'providerDeployment',
  () => new providerDeploymentServiceImpl()
).build();
