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
  ProviderVersion
} from '@metorial-subspace/db';
import { actorPresenter } from './actor';
import { customProviderEnvironmentPresenter } from './customProviderEnvironment';
import { customProviderVersionPresenter } from './customProviderVersion';

export let customProviderCommitPresenter = (
  customProviderCommit: CustomProviderCommit & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

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
      deployment: CustomProviderDeployment;
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
          deployment: CustomProviderDeployment;
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

  createdAt: customProviderCommit.createdAt,
  appliedAt: customProviderCommit.appliedAt
});
