import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type CustomProvider,
  type CustomProviderStatus,
  db,
  type Environment,
  getId,
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
import { providerInternalService } from '@metorial-subspace/module-provider-internal';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { backend } from '../_shuttle/backend';
import { CustomProviderConfig, CustomProviderFrom } from '../_shuttle/types';
import { createVersion } from '../internal/createVersion';
import {
  customProviderCreatedQueue,
  customProviderUpdatedQueue
} from '../queues/lifecycle/customProvider';

let include = {};

class customProviderServiceImpl {
  async listCustomProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: CustomProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: voyagerSource.id,
          indexId: voyagerIndex.customProvider.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

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

  async getCustomProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderId: string;
    allowDeleted?: boolean;
  }) {
    let customProvider = await db.customProvider.findFirst({
      where: {
        id: d.customProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!customProvider)
      throw new ServiceError(notFoundError('custom_provider', d.customProviderId));

    return customProvider;
  }

  async createCustomProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;

      from: CustomProviderFrom;
      config?: CustomProviderConfig;
    };
  }) {
    let backendProvider = await backend.createCustomProvider({
      tenant: d.tenant,

      name: d.input.name,
      description: d.input.description,

      from: d.input.from,
      config: d.input.config!
    });

    return withTransaction(async db => {
      let customProvider = await db.customProvider.create({
        data: {
          ...getId('customProvider'),

          type: backendProvider.shuttleServer.type,
          status: 'active',

          maxVersionIndex: 0,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        }
      });

      let environments = await db.environment.findMany({
        where: { tenantOid: d.tenant.oid }
      });
      await db.customProviderEnvironment.createMany({
        data: environments.map(env => ({
          ...getId('customProviderEnvironment'),
          tenantOid: d.tenant.oid,
          environmentOid: env.oid,
          customProviderOid: customProvider.oid
        }))
      });

      await createVersion({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        trigger: 'manual',
        customProvider,

        shuttleServer: backendProvider.shuttleServer,
        shuttleCustomServer: backendProvider.shuttleCustomServer,
        shuttleCustomDeployment: backendProvider.shuttleCustomDeployment
      });

      await addAfterTransactionHook(async () =>
        customProviderCreatedQueue.add({ customProviderId: customProvider.id })
      );

      return await db.customProvider.findUniqueOrThrow({
        where: { oid: customProvider.oid },
        include
      });
    });
  }

  async updateCustomProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProvider: CustomProvider;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.customProvider);
    checkDeletedEdit(d.customProvider, 'update');

    return withTransaction(async db => {
      let customProvider = await db.customProvider.update({
        where: {
          oid: d.customProvider.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        },
        include: { provider: true }
      });

      if (customProvider.provider) {
        await providerInternalService.updateProvider({
          provider: customProvider.provider,
          input: {
            name: customProvider.name,
            description: customProvider.description ?? undefined
          }
        });
      }

      await addAfterTransactionHook(async () =>
        customProviderUpdatedQueue.add({ customProviderId: customProvider.id })
      );

      return await db.customProvider.findUniqueOrThrow({
        where: { oid: customProvider.oid },
        include
      });
    });
  }
}

export let customProviderService = Service.create(
  'customProvider',
  () => new customProviderServiceImpl()
).build();
