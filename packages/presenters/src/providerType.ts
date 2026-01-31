import type { ProviderType } from '@metorial-subspace/db';

export let providerTypePresenter = (providerType: ProviderType) => ({
  object: 'provider.type',

  id: providerType.id,
  name: providerType.name,

  triggers: providerType.attributes.triggers,
  auth: providerType.attributes.auth,
  config: providerType.attributes.config,

  createdAt: providerType.createdAt
});
