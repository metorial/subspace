import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Provider, Tenant } from '@metorial-subspace/db';
import { providerInternalService } from '@metorial-subspace/module-provider-internal';
import { providerVariantInclude } from './providerVariant';

let include = {
  entry: true,
  publisher: true,
  ownerTenant: true,
  defaultVariant: {
    include: providerVariantInclude
  }
};

export let providerInclude = include;

class providerServiceImpl {
  async getProviderById(d: { providerId: string; tenant: Tenant }) {
    let provider = await db.provider.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.providerId },
              { listing: { id: d.providerId } },
              { listing: { slug: d.providerId } }
            ]
          },

          {
            OR: [{ access: 'public' }, { access: 'tenant', ownerTenantOid: d.tenant.oid }]
          }
        ]
      },
      include
    });
    if (!provider) {
      throw new ServiceError(notFoundError('provider', d.providerId));
    }

    return provider;
  }

  async listProviders(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.provider.findMany({
            ...opts,
            where: {},
            include
          })
      )
    );
  }

  async updateProvider(d: {
    provider: Provider;
    input: {
      name: string;
      description?: string;
      slug: string;
      image: PrismaJson.EntityImage | null;
      skills?: string[];
    };
  }) {
    await providerInternalService.updateProvider({
      provider: d.provider,
      input: {
        name: d.input.name,
        description: d.input.description,
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
