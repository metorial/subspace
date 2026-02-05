import type {
  Actor,
  CustomProvider,
  CustomProviderCommit,
  CustomProviderDeployment,
  CustomProviderVersion,
  Provider,
  ScmRepo,
  ScmRepoPush
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';
import { scmPushPresenter } from './scmPush';

export let customProviderDeploymentPresenter = (
  customProviderDeployment: CustomProviderDeployment & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    customProviderVersion: CustomProviderVersion | null;
    commit: CustomProviderCommit | null;

    creatorActor: Actor;

    scmRepoPush: (ScmRepoPush & { repo: ScmRepo }) | null;
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderDeployment.id,
  status: customProviderDeployment.status,
  trigger: customProviderDeployment.trigger,

  customProviderId: customProviderDeployment.customProvider.id,
  providerId: customProviderDeployment.customProvider.provider?.id,
  customProviderVersionId: customProviderDeployment.customProviderVersion?.id,

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

  scmPush: customProviderDeployment.scmRepoPush
    ? scmPushPresenter(customProviderDeployment.scmRepoPush)
    : null,

  createdAt: customProviderDeployment.createdAt,
  updatedAt: customProviderDeployment.updatedAt
});
