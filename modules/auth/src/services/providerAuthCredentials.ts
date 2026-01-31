import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  Environment,
  getId,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderAuthCredentialsStatus,
  type ProviderVariant,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import {
  providerAuthCredentialsCreatedQueue,
  providerAuthCredentialsUpdatedQueue
} from '../queues/lifecycle/providerAuthCredentials';

let include = {
  provider: true
};

class providerAuthCredentialsServiceImpl {
  async listProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: ProviderAuthCredentialsStatus[];
    allowDeleted?: boolean;

    search?: string;

    ids?: string[];
    providerIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: voyagerSource.id,
          indexId: voyagerIndex.providerAuthCredentials.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthCredentials.findMany({
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
                providers ? { providerOid: providers.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthCredentialsById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthCredentialsId: string;
    allowDeleted?: boolean;
  }) {
    let providerAuthCredentials = await db.providerAuthCredentials.findFirst({
      where: {
        id: d.providerAuthCredentialsId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!providerAuthCredentials)
      throw new ServiceError(notFoundError('provider.config', d.providerAuthCredentialsId));

    return providerAuthCredentials;
  }

  async createProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;

      config: {
        type: 'oauth';
        clientId: string;
        clientSecret: string;
        scopes: string[];
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

      let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
        tenant: d.tenant,
        provider: d.provider,
        input: d.input.config
      });

      let providerAuthCredentials = await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),

          type: backendProviderAuthCredentials.type,
          status: 'active',

          backendOid: backend.backend.oid,

          slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid
        },
        include
      });

      if (providerAuthCredentials.isDefault) {
        await db.providerAuthCredentials.updateMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid,
            oid: {
              not: providerAuthCredentials.oid
            },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsCreatedQueue.add({
          providerAuthCredentialsId: providerAuthCredentials.id
        })
      );

      return providerAuthCredentials;
    });
  }

  async updateProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthCredentials: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerAuthCredentials);
    checkDeletedEdit(d.providerAuthCredentials, 'update');

    return withTransaction(async db => {
      let config = await db.providerAuthCredentials.update({
        where: {
          oid: d.providerAuthCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthCredentials.name,
          description: d.input.description ?? d.providerAuthCredentials.description,
          metadata: d.input.metadata ?? d.providerAuthCredentials.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsUpdatedQueue.add({ providerAuthCredentialsId: config.id })
      );

      return config;
    });
  }
}

export let providerAuthCredentialsService = Service.create(
  'providerAuthCredentials',
  () => new providerAuthCredentialsServiceImpl()
).build();
