import type { ProviderFunctionalityCtorParams } from '@metorial-subspace/provider-utils';
import {
  IProviderFeatures,
  type ProviderFeatureSpec
} from '@metorial-subspace/provider-utils';

export class ProviderFeatures extends IProviderFeatures {
  constructor(params: ProviderFunctionalityCtorParams) {
    super(params);
  }

  override getFeatures(): ProviderFeatureSpec {
    return {
      customProviders: { enabled: false }
    };
  }
}
