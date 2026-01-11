import type { ProviderEntry } from '../../prisma/generated/client';

export let providerEntryPresenter = (providerEntry: ProviderEntry) => ({
  object: 'provider.entry',

  id: providerEntry.id,
  identifier: providerEntry.identifier,

  name: providerEntry.name,
  description: providerEntry.description,
  metadata: providerEntry.metadata,

  createdAt: providerEntry.createdAt,
  updatedAt: providerEntry.updatedAt
});
