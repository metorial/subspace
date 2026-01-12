import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { db, getId, Solution, Tenant } from '@metorial-subspace/db';

class providerListingCollectionServiceImpl {
  async getProviderListingCollectionById(d: {
    tenant: Tenant;
    solution: Solution;
    providerListingCollectionId: string;
  }) {
    let providerListingCollection = await db.providerListingCollection.findFirst({
      where: {
        OR: [{ id: d.providerListingCollectionId }, { slug: d.providerListingCollectionId }]
      }
    });
    if (!providerListingCollection) {
      throw new ServiceError(
        notFoundError('provider_collection', d.providerListingCollectionId)
      );
    }

    return providerListingCollection;
  }

  async listProviderListingCollections(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingCollection.findMany({
            ...opts
          })
      )
    );
  }

  async upsertProviderListingCollection(d: {
    input: { name: string; slug: string; description: string };
  }) {
    let inner = {
      name: d.input.name,
      slug: slugify(d.input.slug),
      description: d.input.description
    };

    return await db.providerListingCollection.upsert({
      where: { slug: inner.slug },
      create: {
        ...getId('providerCollection'),
        ...inner
      },
      update: inner
    });
  }
}

export let providerListingCollectionService = Service.create(
  'providerListingCollectionService',
  () => new providerListingCollectionServiceImpl()
).build();
