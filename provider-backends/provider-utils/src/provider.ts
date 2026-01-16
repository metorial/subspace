import type { IProviderAuth, IProviderToolInvocation } from './interfaces';
import type { IProviderCapabilities } from './interfaces/providerCapabilities';
import type { IProviderCatalog } from './interfaces/providerCatalog';
import type { IProviderDeployment } from './interfaces/providerDeployment';
import type { IProviderFeatures } from './interfaces/providerFeatures';
import type { ProviderFunctionalityCtorParams } from './providerFunctionality';

export interface ProviderImpl {
  auth: new (params: ProviderFunctionalityCtorParams) => IProviderAuth;
  catalog: new (params: ProviderFunctionalityCtorParams) => IProviderCatalog;
  features: new (params: ProviderFunctionalityCtorParams) => IProviderFeatures;
  deployment: new (params: ProviderFunctionalityCtorParams) => IProviderDeployment;
  capabilities: new (params: ProviderFunctionalityCtorParams) => IProviderCapabilities;
  toolInvocation: new (params: ProviderFunctionalityCtorParams) => IProviderToolInvocation;
}

export let createProvider = (impl: ProviderImpl) => ({
  create: (params: ProviderFunctionalityCtorParams) => ({
    auth: new impl.auth(params),
    catalog: new impl.catalog(params),
    features: new impl.features(params),
    deployment: new impl.deployment(params),
    capabilities: new impl.capabilities(params),
    toolInvocation: new impl.toolInvocation(params),

    backend: params.backend
  })
});
