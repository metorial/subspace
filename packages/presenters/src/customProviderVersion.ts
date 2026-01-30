import type {
  CustomProvider,
  CustomProviderDeployment,
  CustomProviderEnvironment,
  CustomProviderEnvironmentVersion,
  CustomProviderVersion,
  Environment,
  Provider,
  ProviderEnvironment,
  ProviderVersion
} from '@metorial-subspace/db';
import { customProviderDeploymentPresenter } from './customProviderDeployment';
import { customProviderEnvironmentPresenter } from './customProviderEnvironment';

export let customProviderVersionPresenter = (
  customProviderVersion: CustomProviderVersion & {
    customProvider: CustomProvider & {
      provider: Provider | null;
    };

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
      customProvider: customProviderVersion.customProvider
    }),

    environments: customEnvironments.map(cev => ({
      object: 'custom_provider.environment',

      id: cev.id,

      isCurrentVersionForEnvironment:
        customProviderVersion.providerVersion?.oid ==
        cev.providerEnvironment?.currentVersion?.oid,

      environment: customProviderEnvironmentPresenter({
        ...cev,
        customProvider: customProviderVersion.customProvider
      })
    })),

    customProviderId: customProviderVersion.customProvider.id,
    providerId: customProviderVersion.customProvider.provider?.id,

    createdAt: customProviderVersion.createdAt,
    updatedAt: customProviderVersion.updatedAt
  };
};
