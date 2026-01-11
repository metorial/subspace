import type { ProviderAuthMethod } from '../../prisma/generated/browser';
import type {
  Provider,
  ProviderSpecification,
  ProviderTool
} from '../../prisma/generated/client';
import { providerAuthMethodPresenter } from './providerAuthMethod';
import { providerToolPresenter } from './providerTool';

export let providerSpecificationPresenter = (
  providerSpecification: ProviderSpecification & {
    provider: Provider;
    tools: ProviderTool[];
    authMethods: ProviderAuthMethod[];
  }
) => ({
  object: 'provider.capabilities.specification',

  id: providerSpecification.id,
  key: providerSpecification.key,

  name: providerSpecification.name,
  description: providerSpecification.description,

  tools: providerSpecification.tools.map(t =>
    providerToolPresenter({
      ...t,
      provider: providerSpecification.provider
    })
  ),

  authMethods: providerSpecification.authMethods.map(am =>
    providerAuthMethodPresenter({
      ...am,
      provider: providerSpecification.provider
    })
  ),

  createdAt: providerSpecification.createdAt,
  updatedAt: providerSpecification.updatedAt
});
