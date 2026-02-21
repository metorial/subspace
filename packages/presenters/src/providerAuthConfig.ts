import type {
  Provider,
  ProviderAuthMethod,
  ProviderSpecification
} from '@metorial-subspace/db';

export let providerAuthConfigSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema: d.authMethod.value.inputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});

export let providerAuthConfigImportSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema:
    d.authMethod.type === 'oauth'
      ? d.authMethod.value.outputJsonSchema
      : d.authMethod.value.inputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});

export let providerAuthConfigExportSchemaPresenter = (d: {
  provider: Provider;
  specification: ProviderSpecification;
  authMethod: ProviderAuthMethod;
}) => ({
  object: 'provider.capabilities.auth_config.schema',

  authConfigSchema: d.authMethod.value.outputJsonSchema,

  authConfigVisibility: 'encrypted' as const,

  specificationId: d.specification.id,
  providerId: d.provider.id,

  createdAt: d.authMethod.createdAt,
  updatedAt: d.authMethod.updatedAt
});
