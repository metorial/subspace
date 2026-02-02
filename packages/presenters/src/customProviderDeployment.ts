import type {
  Actor,
  CustomProvider,
  CustomProviderCommit,
  CustomProviderDeployment,
  CustomProviderVersion,
  Provider
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';

export let customProviderDeploymentPresenter = (
  customProviderDeployment: CustomProviderDeployment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    customProviderVersion: CustomProviderVersion | null;
    commit: CustomProviderCommit | null;

    creatorActor: Actor;
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderDeployment.id,
  status: customProviderDeployment.status,
  trigger: customProviderDeployment.trigger,

  customProviderId: customProviderDeployment.customProvider.id,
  providerId: customProviderDeployment.customProvider.provider?.id,
  customProviderVersionId: customProviderDeployment.customProviderVersion?.id!,

  commit: customProviderDeployment.commit
    ? {
        object: 'custom_provider.deployment.commit',
        id: customProviderDeployment.commit.id,
        type: customProviderDeployment.commit.type,
        message: customProviderDeployment.commit.message,
        createdAt: customProviderDeployment.commit.createdAt
      }
    : null,

  actor: actorPresenter(customProviderDeployment.creatorActor),

  createdAt: customProviderDeployment.createdAt,
  updatedAt: customProviderDeployment.updatedAt
});
