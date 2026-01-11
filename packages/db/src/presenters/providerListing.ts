import type {
  Provider,
  ProviderEntry,
  ProviderListing,
  ProviderListingCategory,
  ProviderListingCollection,
  ProviderListingGroup,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '../../prisma/generated/client';
import { providerPresenter } from './provider';
import { providerListingCategoryPresenter } from './providerListingCategory';
import { providerListingCollectionPresenter } from './providerListingCollection';
import { providerListingGroupPresenter } from './providerListingGroup';

export let providerListingPresenter = (
  providerListing: ProviderListing & {
    provider: Provider & {
      entry: ProviderEntry;
      publisher: Publisher;
      ownerTenant: Tenant | null;

      defaultVariant:
        | (ProviderVariant & {
            provider: Provider;
            currentVersion: ProviderVersion | null;
          })
        | null;
    };

    categories: ProviderListingCategory[];
    collections: ProviderListingCollection[];
    groups: ProviderListingGroup[];
  }
) => ({
  object: 'provider.listing',

  id: providerListing.id,

  isPublic: providerListing.isPublic,
  isCustomized: providerListing.isCustomized,

  isMetorial: providerListing.isMetorial,
  isVerified: providerListing.isVerified,
  isOfficial: providerListing.isOfficial,

  name: providerListing.name,
  description: providerListing.description,
  slug: providerListing.slug,
  image: providerListing.image,

  readme: providerListing.readme,
  skills: providerListing.skills,

  rank: providerListing.rank,

  deploymentsCount: providerListing.deploymentsCount,
  providerSessionsCount: providerListing.providerSessionsCount,
  providerMessagesCount: providerListing.providerMessagesCount,

  provider: providerPresenter(providerListing.provider),

  categories: providerListing.categories.map(category =>
    providerListingCategoryPresenter(category)
  ),
  collections: providerListing.collections.map(category =>
    providerListingCollectionPresenter(category)
  ),
  groups: providerListing.groups.map(category => providerListingGroupPresenter(category)),

  createdAt: providerListing.createdAt,
  updatedAt: providerListing.updatedAt
});
