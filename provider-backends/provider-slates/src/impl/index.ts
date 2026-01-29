import { createProvider } from '@metorial-subspace/provider-utils';
import { ProviderAuth } from './auth';
import { ProviderCapabilities } from './capabilities';
import { ProviderDeployment } from './deployment';
import { ProviderFeatures } from './features';
import { ProviderRun } from './run';

export let slatesProvider = createProvider({
  auth: ProviderAuth,
  providerRun: ProviderRun,
  features: ProviderFeatures,
  deployment: ProviderDeployment,
  capabilities: ProviderCapabilities
});
