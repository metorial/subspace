import type { Provider, ProviderAuthCredentials } from '@metorial-subspace/db';

export let providerAuthCredentialsPresenter = (
  providerAuthCredentials: ProviderAuthCredentials & {
    provider: Provider;
  }
) => ({
  object: 'provider.auth_credentials',

  id: providerAuthCredentials.id,
  type: providerAuthCredentials.type,

  isEphemeral: providerAuthCredentials.isEphemeral,
  isDefault: providerAuthCredentials.isDefault,

  providerId: providerAuthCredentials.provider.id,

  name: providerAuthCredentials.name,
  description: providerAuthCredentials.description,
  metadata: providerAuthCredentials.metadata,

  createdAt: providerAuthCredentials.createdAt,
  updatedAt: providerAuthCredentials.updatedAt
});
