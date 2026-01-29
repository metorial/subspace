import { createProvider } from '@metorial-subspace/provider-utils';
import { ProviderAuth } from './auth';
import { ProviderCapabilities } from './capabilities';
import { ProviderDeployment } from './deployment';
import { ProviderFeatures } from './features';
import { ProviderToolInvocation } from './toolInvocation';

export let shuttleProvider = createProvider({
  auth: ProviderAuth,
  features: ProviderFeatures,
  deployment: ProviderDeployment,
  capabilities: ProviderCapabilities,
  toolInvocation: ProviderToolInvocation
});
