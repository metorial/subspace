import type { Provider, ProviderSpecification } from '@metorial-subspace/db';

export let providerConfigSchemaPresenter = (
  providerSpecification: ProviderSpecification & {
    provider: Provider;
  }
) => ({
  object: 'provider.capabilities.config_schema',

  configSchema: providerSpecification.value.specification.configJsonSchema,
  configVisibility: providerSpecification.value.specification.configVisibility,

  specificationId: providerSpecification.id,
  providerId: providerSpecification.provider.id,

  createdAt: providerSpecification.createdAt,
  updatedAt: providerSpecification.updatedAt
});
