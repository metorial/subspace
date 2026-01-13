import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  Backend,
  getId,
  Provider,
  Publisher,
  Slate,
  withTransaction
} from '@metorial-subspace/db';
import { createTag } from '../lib/createTag';
import { listingCreatedQueue, listingUpdatedQueue } from '../queues/lifecycle/listing';
import { providerCreatedQueue, providerUpdatedQueue } from '../queues/lifecycle/provider';

class providerInternalServiceImpl {
  async upsertProvider(d: {
    publisher: Publisher;

    source: {
      type: 'slates';
      slate: Slate;
      backend: Backend;
    };

    info: {
      name: string;
      description?: string;
      slug: string;
      image: PrismaJson.EntityImage | null;
      skills?: string[];
      readme?: string;
    };
  }) {
    return withTransaction(async db => {
      let identifier = `provider::${d.source.type}::${d.source.slate.id}`;

      let providerEntryData = {
        identifier: `${identifier}::entry`,
        name: d.info.name,
        description: d.info.description,
        publisherOid: d.publisher.oid
      };
      let entry = await db.providerEntry.upsert({
        where: {
          identifier: providerEntryData.identifier
        },
        create: {
          ...getId('providerEntry'),
          ...providerEntryData
        },
        update: providerEntryData
      });

      let providerData = {
        identifier: `${identifier}::provider`,

        access: 'public' as const,
        status: 'active' as const,

        name: d.info.name,
        description: d.info.description,

        entryOid: entry.oid,
        publisherOid: d.publisher.oid
      };
      let existingProvider = await db.provider.findFirst({
        where: { identifier }
      });

      let newProviderId = getId('provider');
      let provider = existingProvider
        ? await db.provider.update({
            where: { identifier },
            data: providerData
          })
        : await db.provider.upsert({
            where: {
              identifier: providerData.identifier
            },
            create: {
              ...newProviderId,
              ...providerData,
              slug: d.info.slug,
              tag: await createTag()
            },
            update: providerData
          });

      let variantData = {
        identifier: `${identifier}::variant`,

        isDefault: true,

        name: d.info.name,
        description: d.info.description,

        backendOid: d.source.backend.oid,
        providerOid: provider.oid,
        slateOid: d.source.slate.oid,
        publisherOid: d.publisher.oid
      };
      let existingVariant = await db.providerVariant.findFirst({
        where: { identifier: variantData.identifier }
      });
      let variant = existingVariant
        ? await db.providerVariant.update({
            where: { identifier: variantData.identifier },
            data: variantData
          })
        : await db.providerVariant.upsert({
            where: { identifier: variantData.identifier },
            create: {
              ...getId('providerVariant'),
              ...variantData,
              tag: await createTag()
            },
            update: variantData
          });

      await db.provider.updateMany({
        where: { oid: provider.oid },
        data: { defaultVariantOid: variant.oid }
      });

      let listing = await db.providerListing.findFirst({
        where: { providerOid: provider.oid }
      });

      let allData = {
        isPublic: provider.access === 'public',
        ownerTenantOid: provider.access === 'tenant' ? provider.ownerTenantOid : null,
        publisherOid: provider.publisherOid,
        providerOid: provider.oid
      };

      let newListingId = getId('providerListing');
      if (!listing?.isCustomized) {
        let inner = {
          ...allData,

          name: d.info.name,
          description: d.info.description,
          slug: d.info.slug,

          readme: d.info.readme,

          skills: d.info.skills || [],

          isCustomized: false,

          isMetorial: d.publisher.type === 'metorial',
          isVerified: d.publisher.type === 'metorial',
          isOfficial: false
        };

        listing = await db.providerListing.upsert({
          where: { providerOid: provider.oid },
          create: {
            ...newListingId,
            ...inner,
            status: 'active'
          },
          update: inner
        });
      } else {
        listing = await db.providerListing.update({
          where: { providerOid: provider.oid },
          data: allData
        });
      }

      await addAfterTransactionHook(async () => {
        if (provider.id == newProviderId.id) {
          await providerCreatedQueue.add({ providerId: provider.id });
        } else {
          await providerUpdatedQueue.add({ providerId: provider.id });
        }
      });
      await addAfterTransactionHook(async () => {
        if (listing.id == newListingId.id) {
          await listingCreatedQueue.add({ providerListingId: listing.id });
        } else {
          await listingUpdatedQueue.add({ providerListingId: listing.id });
        }
      });

      return await db.provider.findFirstOrThrow({
        where: { oid: provider.oid },
        include: {
          defaultVariant: true
        }
      });
    });
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
    return withTransaction(async db => {
      let provider = await db.provider.update({
        where: { id: d.provider.id },
        data: {
          slug: d.input.slug,
          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined
        }
      });

      let listing = await db.providerListing.update({
        where: { oid: provider.oid, isCustomized: true },
        data: {
          slug: provider.slug,
          name: provider.name,
          description: provider.description,
          skills: d.input.skills,
          image: d.input.image ?? undefined
        }
      });

      await addAfterTransactionHook(() =>
        listingUpdatedQueue.add({ providerListingId: listing.id })
      );

      return provider;
    });
  }
}

export let providerInternalService = Service.create(
  'providerInternalService',
  () => new providerInternalServiceImpl()
).build();
