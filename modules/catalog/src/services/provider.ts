import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Provider,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { providerInternalService } from '@metorial-subspace/module-provider-internal';
import { providerVariantInclude } from './providerVariant';

let include = {
  entry: true,
  publisher: true,
  ownerTenant: true,
  defaultVariant: {
    include: providerVariantInclude
  },
  type: true
};

export let providerInclude = include;

export let getProviderTenantFilter = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}) => ({
  OR: [
    { access: 'public' as const },
    {
      access: 'tenant' as const,
      ownerTenantOid: d.tenant.oid,
      ownerSolutionOid: d.solution.oid
    }
  ]
});

class providerServiceImpl {
  async getProviderById(d: {
    providerId: string;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
  }) {
    let provider = await db.provider.findFirst({
      where: {
        AND: [
          getProviderTenantFilter(d),

          {
            OR: [
              { id: d.providerId },
              { globalIdentifier: d.providerId },
              { listing: { id: d.providerId } },
              { listing: { slug: d.providerId } }
            ]
          }
        ].filter(Boolean)
      },
      include
    });
    if (!provider) {
      throw new ServiceError(notFoundError('provider', d.providerId));
    }

    return provider;
  }

  async listProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    search?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.provider.findMany({
            ...opts,
            where: getProviderTenantFilter(d),
            include
          })
      )
    );
  }

  async updateProvider(d: {
    provider: Provider;
    input: {
      name?: string;
      description?: string;
      slug?: string;
      image?: PrismaJson.EntityImage | null;
      skills?: string[];
    };
  }) {
    await providerInternalService.updateProvider({
      provider: d.provider,
      input: {
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        slug: d.input.slug,
        image: d.input.image,
        skills: d.input.skills
      }
    });

    return await db.provider.findFirstOrThrow({
      where: { id: d.provider.id },
      include
    });
  }
}

export let providerService = Service.create(
  'providerService',
  () => new providerServiceImpl()
).build();
