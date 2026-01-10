import type { IProviderAuth } from './interfaces';
import type { IProviderCapabilities } from './interfaces/providerCapabilities';
import type { IProviderCatalog } from './interfaces/providerCatalog';
import type { IProviderDeployment } from './interfaces/providerDeployment';
import type { IProviderFeatures } from './interfaces/providerFeatures';
import type { ProviderFunctionalityCtorParams } from './providerFunctionality';

export interface ProviderImpl {
  features: new (params: ProviderFunctionalityCtorParams) => IProviderFeatures;
  catalog: new (params: ProviderFunctionalityCtorParams) => IProviderCatalog;
  deployment: new (params: ProviderFunctionalityCtorParams) => IProviderDeployment;
  capabilities: new (params: ProviderFunctionalityCtorParams) => IProviderCapabilities;
  auth: new (params: ProviderFunctionalityCtorParams) => IProviderAuth;
}

export let createProvider = (impl: ProviderImpl) => ({
  create: (params: ProviderFunctionalityCtorParams) => ({
    features: new impl.features(params),
    catalog: new impl.catalog(params),
    deployment: new impl.deployment(params),
    capabilities: new impl.capabilities(params),
    auth: new impl.auth(params),

    backend: params.backend
  })
});
