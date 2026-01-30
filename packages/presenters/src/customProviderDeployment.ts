import type {
  Actor,
  CustomProvider,
  CustomProviderDeployment,
  Provider
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';

export let customProviderDeploymentPresenter = (
  customProviderDeployment: CustomProviderDeployment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    creatorActor: Actor;
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderDeployment.id,
  status: customProviderDeployment.status,
  trigger: customProviderDeployment.trigger,

  customProviderId: customProviderDeployment.customProvider.id,
  providerId: customProviderDeployment.customProvider.provider?.id,

  actor: actorPresenter(customProviderDeployment.creatorActor),

  createdAt: customProviderDeployment.createdAt,
  updatedAt: customProviderDeployment.updatedAt
});
