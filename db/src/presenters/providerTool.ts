import type {
  Provider,
  ProviderSpecification,
  ProviderTool
} from '../../prisma/generated/client';

export let providerToolPresenter = (
  providerTool: ProviderTool & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'>;
  }
) => ({
  object: 'provider.capabilities.tool',

  id: providerTool.id,
  key: providerTool.key,

  name: providerTool.name,
  description: providerTool.description,

  capabilities: providerTool.value.capabilities,
  constraints: providerTool.value.constraints,
  inputJsonSchema: providerTool.value.inputJsonSchema,
  instructions: providerTool.value.instructions,
  outputJsonSchema: providerTool.value.outputJsonSchema,
  tags: providerTool.value.tags,

  specificationId: providerTool.specification.id,

  createdAt: providerTool.createdAt,
  updatedAt: providerTool.updatedAt
});
