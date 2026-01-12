import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Solution, Tenant } from '@metorial-subspace/db';

class providerSpecificationServiceImpl {
  async listProviderSpecifications(d: {
    tenant: Tenant;
    solution: Solution;

    providerIds?: string[];
    providerVersionIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
  }) {
    let providers = d.providerIds
      ? await db.provider.findMany({ where: { id: { in: d.providerIds } } })
      : undefined;
    let versions = d.providerVersionIds
      ? await db.providerVersion.findMany({
          where: { id: { in: d.providerVersionIds } }
        })
      : undefined;
    let deployments = d.providerDeploymentIds
      ? await db.providerDeployment.findMany({
          where: { id: { in: d.providerDeploymentIds } },
          include: { lockedVersion: true }
        })
      : undefined;
    let configs = d.providerConfigIds
      ? await db.providerConfig.findMany({
          where: { id: { in: d.providerConfigIds } }
        })
      : undefined;

    let specOids = [
      ...(versions?.map(v => v.specificationOid!).filter(o => o) ?? []),
      ...(deployments?.map(d => d.lockedVersion?.specificationOid!).filter(o => o) ?? []),
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
                  provider: {
                    OR: [
                      { access: 'public' as const },
                      {
                        access: 'tenant' as const,
                        ownerTenantOid: d.tenant.oid,
                        ownerSolutionOid: d.solution.oid
                      }
                    ]
                  }
                },

                providers ? { providerOid: { in: providers.map(p => p.oid) } } : undefined!,
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
    tenant: Tenant;
    solution: Solution;
    providerSpecificationId: string;
  }) {
    let providerSpecification = await db.providerSpecification.findFirst({
      where: {
        provider: {
          OR: [
            { access: 'public' as const },
            {
              access: 'tenant' as const,
              ownerTenantOid: d.tenant.oid,
              ownerSolutionOid: d.solution.oid
            }
          ]
        },

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
