import type {
  Actor,
  CustomProvider,
  CustomProviderCommit,
  CustomProviderDeployment,
  CustomProviderEnvironment,
  CustomProviderEnvironmentVersion,
  CustomProviderVersion,
  Environment,
  Provider,
  ProviderEnvironment,
  ProviderVersion,
  ScmRepo,
  ScmRepoPush
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';
import { customProviderEnvironmentPresenter } from './customProviderEnvironment';
import { customProviderVersionPresenter } from './customProviderVersion';
import { scmPushPresenter } from './scmPush';

export let customProviderCommitPresenter = (
  customProviderCommit: CustomProviderCommit & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    customProviderDeployment: CustomProviderDeployment | null;

    toEnvironment: CustomProviderEnvironment & {
      environment: Environment;
      providerEnvironment:
        | (ProviderEnvironment & {
            currentVersion: ProviderVersion | null;
          })
        | null;
    };

    fromEnvironment:
      | (CustomProviderEnvironment & {
          environment: Environment;
          providerEnvironment:
            | (ProviderEnvironment & {
                currentVersion: ProviderVersion | null;
              })
            | null;
        })
      | null;

    targetCustomProviderVersion: CustomProviderVersion & {
      deployment: CustomProviderDeployment & {
        commit: CustomProviderCommit | null;
      };
      providerVersion: ProviderVersion | null;
      customProviderEnvironmentVersions: (CustomProviderEnvironmentVersion & {
        customProviderEnvironment: CustomProviderEnvironment & {
          environment: Environment;
          providerEnvironment:
            | (ProviderEnvironment & {
                currentVersion: ProviderVersion | null;
              })
            | null;
        };
      })[];
      creatorActor: Actor;
    };

    toEnvironmentVersionBefore:
      | (CustomProviderVersion & {
          deployment: CustomProviderDeployment & {
            commit: CustomProviderCommit | null;
          };
          providerVersion: ProviderVersion | null;
          customProviderEnvironmentVersions: (CustomProviderEnvironmentVersion & {
            customProviderEnvironment: CustomProviderEnvironment & {
              environment: Environment;
              providerEnvironment:
                | (ProviderEnvironment & {
                    currentVersion: ProviderVersion | null;
                  })
                | null;
            };
          })[];
          creatorActor: Actor;
        })
      | null;

    creatorActor: Actor;

    scmRepoPush: (ScmRepoPush & { repo: ScmRepo }) | null;
  }
) => ({
  object: 'custom_provider.deployment',

  id: customProviderCommit.id,
  status: customProviderCommit.status,
  trigger: customProviderCommit.trigger,

  error: customProviderCommit.errorCode
    ? {
        code: customProviderCommit.errorCode,
        message: customProviderCommit.errorMessage ?? customProviderCommit.errorCode
      }
    : null,

  customProviderId: customProviderCommit.customProvider.id,
  providerId: customProviderCommit.customProvider.provider?.id,
  customProviderDeploymentId: customProviderCommit.customProviderDeployment?.id || null,

  toEnvironment: customProviderEnvironmentPresenter({
    ...customProviderCommit.toEnvironment,
    customProvider: customProviderCommit.customProvider
  }),
  fromEnvironment: customProviderCommit.fromEnvironment
    ? customProviderEnvironmentPresenter({
        ...customProviderCommit.fromEnvironment,
        customProvider: customProviderCommit.customProvider
      })
    : null,

  targetCustomProviderVersion: customProviderVersionPresenter({
    ...customProviderCommit.targetCustomProviderVersion,
    customProvider: customProviderCommit.customProvider
  }),
  previousCustomProviderVersion: customProviderCommit.toEnvironmentVersionBefore
    ? customProviderVersionPresenter({
        ...customProviderCommit.toEnvironmentVersionBefore,
        customProvider: customProviderCommit.customProvider
      })
    : null,

  actor: actorPresenter(customProviderCommit.creatorActor),

  scmPush: customProviderCommit.scmRepoPush
    ? scmPushPresenter(customProviderCommit.scmRepoPush)
    : null,

  createdAt: customProviderCommit.createdAt,
  appliedAt: customProviderCommit.appliedAt
});
