import type {
  CustomProvider,
  CustomProviderDeployment,
  Provider
} from '@metorial-subspace/db';

export let customProviderDeploymentPresenter = (
  customProviderDeployment: CustomProviderDeployment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderDeployment.id,
  status: customProviderDeployment.status,
  trigger: customProviderDeployment.trigger,

  customProviderId: customProviderDeployment.customProvider.id,
  providerId: customProviderDeployment.customProvider.provider?.id,

  createdAt: customProviderDeployment.createdAt,
  updatedAt: customProviderDeployment.updatedAt
});
