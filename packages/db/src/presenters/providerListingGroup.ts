import type { ProviderListingGroup } from '../../prisma/generated/client';

export let providerListingGroupPresenter = (providerListingGroup: ProviderListingGroup) => ({
  object: 'provider.listing_group',

  id: providerListingGroup.id,

  name: providerListingGroup.name,
  description: providerListingGroup.description,
  slug: providerListingGroup.slug,

  createdAt: providerListingGroup.createdAt,
  updatedAt: providerListingGroup.updatedAt
});
