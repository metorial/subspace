import type {
  Actor,
  CodeBucket,
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
import { bucketPresenter } from './bucket';
import { customProviderDeploymentPresenter } from './customProviderDeployment';
import { customProviderEnvironmentPresenter } from './customProviderEnvironment';

export let customProviderVersionPresenter = (
  customProviderVersion: CustomProviderVersion & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

    deployment: CustomProviderDeployment & {
      commit: CustomProviderCommit | null;

      scmRepoPush:
        | (ScmRepoPush & {
            repo: ScmRepo;
          })
        | null;
    };

    immutableCodeBucket: (CodeBucket & { scmRepo: ScmRepo | null }) | null;

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
  }
) => {
  let customEnvironments = customProviderVersion.customProviderEnvironmentVersions.map(
    v => v.customProviderEnvironment
  );

  return {
    object: 'custom_provider.version',

    id: customProviderVersion.id,
    status: customProviderVersion.status,

    index: customProviderVersion.versionIndex,
    identifier: customProviderVersion.versionIdentifier,

    deployment: customProviderDeploymentPresenter({
      ...customProviderVersion.deployment,
      customProvider: customProviderVersion.customProvider,
      creatorActor: customProviderVersion.creatorActor,
      customProviderVersion: customProviderVersion,
      immutableCodeBucket: customProviderVersion.immutableCodeBucket
    }),

    environments: customEnvironments.map(cev => ({
      object: 'custom_provider.environment',

      id: cev.id,

      isCurrentVersionForEnvironment:
        customProviderVersion.providerVersion?.oid ===
        cev.providerEnvironment?.currentVersion?.oid,

      environment: customProviderEnvironmentPresenter({
        ...cev,
        customProvider: customProviderVersion.customProvider
      })
    })),

    immutableBucket: customProviderVersion.immutableCodeBucket
      ? bucketPresenter(customProviderVersion.immutableCodeBucket)
      : null,

    customProviderId: customProviderVersion.customProvider.id,
    providerId: customProviderVersion.customProvider.provider?.id,

    actor: actorPresenter(customProviderVersion.creatorActor),

    createdAt: customProviderVersion.createdAt,
    updatedAt: customProviderVersion.updatedAt
  };
};
