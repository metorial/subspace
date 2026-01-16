import { createProvider } from '@metorial-subspace/provider-utils';
import { ProviderAuth } from './auth';
import { ProviderCapabilities } from './capabilities';
import { ProviderCatalog } from './catalog';
import { ProviderDeployment } from './deployment';
import { ProviderFeatures } from './features';
import { ProviderToolInvocation } from './toolInvocation';

export let slatesProvider = createProvider({
  auth: ProviderAuth,
  catalog: ProviderCatalog,
  features: ProviderFeatures,
  deployment: ProviderDeployment,
  capabilities: ProviderCapabilities,
  toolInvocation: ProviderToolInvocation
});
