import type { Provider, ProviderTool } from '../../prisma/generated/client';

export let providerToolPresenter = (
  providerTool: ProviderTool & {
    provider: Provider;
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

  createdAt: providerTool.createdAt,
  updatedAt: providerTool.updatedAt
});
