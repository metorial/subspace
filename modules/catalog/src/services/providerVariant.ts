import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Provider, Solution, Tenant } from '@metorial-subspace/db';

let include = {
  backend: true,
  publisher: true,
  slate: true,
  currentVersion: true
};

export let providerVariantInclude = include;

class providerVariantServiceImpl {
  async getProviderVariantById(d: {
    providerVariantId: string;
    tenant: Tenant;
    solution: Solution;
    provider?: Provider;
  }) {
    let providerVariant = await db.providerVariant.findFirst({
      where: {
        providerOid: d.provider ? d.provider.oid : undefined,

        AND: [
          {
            OR: [{ id: d.providerVariantId }, { identifier: d.providerVariantId }]
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
    if (!providerVariant) {
      throw new ServiceError(notFoundError('provider_variant', d.providerVariantId));
    }

    return providerVariant;
  }

  async listProviderVariants(d: { provider: Provider }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVariant.findMany({
            ...opts,
            where: {
              providerOid: d.provider.oid
            },
            include
          })
      )
    );
  }
}

export let providerVariantService = Service.create(
  'providerVariantService',
  () => new providerVariantServiceImpl()
).build();
