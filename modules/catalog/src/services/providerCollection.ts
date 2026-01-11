import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, getId, Tenant } from '@metorial-subspace/db';

class providerListingCollectionServiceImpl {
  async getProviderListingCollectionById(d: {
    tenant: Tenant;
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

  async listProviderListingCollections(d: { tenant: Tenant }) {
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
      slug: d.input.slug,
      description: d.input.description
    };

    return await db.providerListingCollection.upsert({
      where: { slug: d.input.slug },
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
