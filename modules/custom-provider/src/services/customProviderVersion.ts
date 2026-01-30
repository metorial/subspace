import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  resolveCustomProviderDeployments,
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveProviders
} from '@metorial-subspace/list-utils';

let include = {};

class customProviderVersionServiceImpl {
  async listCustomProviderVersions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    customProviderIds?: string[];
    customProviderDeploymentIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerVersions = await resolveProviders(d, d.providerVersionIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderDeployments = await resolveCustomProviderDeployments(
      d,
      d.customProviderDeploymentIds
    );
    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderVersion.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                providerVersions ? { providerVersionOid: providerVersions.in } : undefined!,

                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderDeployments
                  ? { deploymentOid: customProviderDeployments.in }
                  : undefined!,
                customProviderEnvironments
                  ? {
                      customProviderEnvironmentVersions: {
                        some: { customProviderEnvironmentOid: customProviderEnvironments.in }
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

  async getCustomProviderVersionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderVersionId: string;
  }) {
    let customProviderVersion = await db.customProviderVersion.findFirst({
      where: {
        id: d.customProviderVersionId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!customProviderVersion)
      throw new ServiceError(
        notFoundError('custom_provider.version', d.customProviderVersionId)
      );

    return customProviderVersion;
  }
}

export let customProviderVersionService = Service.create(
  'customProviderVersion',
  () => new customProviderVersionServiceImpl()
).build();
