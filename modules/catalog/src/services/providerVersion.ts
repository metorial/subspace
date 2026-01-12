import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Solution, Tenant } from '@metorial-subspace/db';
import { providerVariantInclude } from './providerVariant';

let include = {
  provider: true,
  providerVariant: { include: providerVariantInclude },
  slate: true,
  slateVersion: true,
  specification: true
};

class providerVersionServiceImpl {
  async getProviderVersionById(d: {
    providerVersionId: string;
    tenant: Tenant;
    solution: Solution;
  }) {
    let providerVersion = await db.providerVersion.findFirst({
      where: {
        AND: [
          {
            OR: [{ id: d.providerVersionId }, { identifier: d.providerVersionId }]
          },

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
          }
        ]
      },
      include
    });
    if (!providerVersion) {
      throw new ServiceError(notFoundError('provider.version', d.providerVersionId));
    }

    return providerVersion;
  }

  async listProviderVersions(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVersion.findMany({
            ...opts,
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
              }
            },
            include
          })
      )
    );
  }
}

export let providerVersionService = Service.create(
  'providerVersionService',
  () => new providerVersionServiceImpl()
).build();
