import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  resolveCustomProviders,
  resolveCustomProviderVersions
} from '@metorial-subspace/list-utils';

let include = {};

class customProviderEnvironmentServiceImpl {
  async listCustomProviderEnvironments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
  }) {
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderVersions(
      d,
      d.customProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderEnvironment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderVersions
                  ? {
                      customProviderEnvironmentVersions: {
                        some: { customProviderVersionOid: customProviderVersions.in }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getCustomProviderEnvironmentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderEnvironmentId: string;
  }) {
    let customProviderEnvironment = await db.customProviderEnvironment.findFirst({
      where: {
        id: d.customProviderEnvironmentId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!customProviderEnvironment)
      throw new ServiceError(
        notFoundError('custom_provider.environment', d.customProviderEnvironmentId)
      );

    return customProviderEnvironment;
  }
}

export let customProviderEnvironmentService = Service.create(
  'customProviderEnvironment',
  () => new customProviderEnvironmentServiceImpl()
).build();
