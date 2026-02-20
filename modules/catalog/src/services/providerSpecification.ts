import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { resolveProviders } from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from './provider';

class providerSpecificationServiceImpl {
  async listProviderSpecifications(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);

    let versions = d.providerVersionIds
      ? await db.providerVersion.findMany({
          where: { id: { in: d.providerVersionIds } }
        })
      : undefined;
    let deployments = d.providerDeploymentIds
      ? await db.providerDeployment.findMany({
          where: { id: { in: d.providerDeploymentIds } },
          include: { currentVersion: { include: { lockedVersion: true } } }
        })
      : undefined;
    let configs = d.providerConfigIds
      ? await db.providerConfig.findMany({
          where: { id: { in: d.providerConfigIds } }
        })
      : undefined;

    let specOids = [
      ...(versions?.map(v => v.specificationOid!).filter(o => o) ?? []),
      ...(deployments
        ?.map(d => d.currentVersion?.lockedVersion?.specificationOid!)
        .filter(o => o) ?? []),
      ...(configs?.map(c => c.specificationOid) ?? [])
    ];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerSpecification.findMany({
            ...opts,

            where: {
              AND: [
                {
                  provider: getProviderTenantFilter(d)
                },

                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                specOids.length ? { oid: { in: specOids } } : undefined!
              ].filter(Boolean)
            },

            include: {
              provider: true,
              providerTools: true,
              providerAuthMethods: true
            }
          })
      )
    );
  }

  async getProviderSpecificationById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerSpecificationId: string;
  }) {
    let providerSpecification = await db.providerSpecification.findFirst({
      where: {
        provider: getProviderTenantFilter(d),

        id: d.providerSpecificationId
      },
      include: {
        provider: true,
        providerTools: true,
        providerAuthMethods: true
      }
    });
    if (!providerSpecification) {
      throw new ServiceError(notFoundError('provider_tool', d.providerSpecificationId));
    }

    return providerSpecification;
  }
}

export let providerSpecificationService = Service.create(
  'providerSpecificationService',
  () => new providerSpecificationServiceImpl()
).build();
