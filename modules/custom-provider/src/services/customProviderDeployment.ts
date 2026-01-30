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

class customProviderDeploymentServiceImpl {
  async listCustomProviderDeployments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerVersions = await resolveProviders(d, d.providerVersionIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderVersions = await resolveCustomProviderDeployments(
      d,
      d.customProviderVersionIds
    );
    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderDeployment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                providerVersions
                  ? { customProviderVersion: { providerVersionOid: providerVersions.in } }
                  : undefined!,

                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderVersions
                  ? { customProviderVersion: { oid: customProviderVersions.in } }
                  : undefined!,
                customProviderEnvironments
                  ? {
                      OR: [
                        {
                          sourceEnvironmentOid: customProviderEnvironments.in
                        },
                        {
                          customProviderVersion: {
                            customProviderEnvironmentVersions: {
                              some: {
                                customProviderEnvironmentOid: customProviderEnvironments.in
                              }
                            }
                          }
                        }
                      ]
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getCustomProviderDeploymentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderDeploymentId: string;
  }) {
    let customProviderDeployment = await db.customProviderDeployment.findFirst({
      where: {
        id: d.customProviderDeploymentId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!customProviderDeployment)
      throw new ServiceError(
        notFoundError('custom_provider.deployment', d.customProviderDeploymentId)
      );

    return customProviderDeployment;
  }
}

export let customProviderDeploymentService = Service.create(
  'customProviderDeployment',
  () => new customProviderDeploymentServiceImpl()
).build();
