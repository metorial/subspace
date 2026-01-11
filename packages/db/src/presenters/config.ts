import type {
  Provider,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment
} from '../../prisma/generated/client';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerConfigVaultPresenter } from './vault';

export let providerConfigPresenter = (
  providerConfig: ProviderConfig & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    fromVault:
      | (ProviderConfigVault & {
          deployment: ProviderDeployment | null;
        })
      | null;
  }
) => ({
  object: 'provider.config',

  id: providerConfig.id,

  isEphemeral: providerConfig.isEphemeral,
  isDefault: providerConfig.isDefault,

  name: providerConfig.name,
  description: providerConfig.description,
  metadata: providerConfig.metadata,

  providerId: providerConfig.provider.id,

  deployment: providerConfig.deployment
    ? providerDeploymentPreviewPresenter({
        ...providerConfig.deployment,
        provider: providerConfig.provider
      })
    : null,

  fromVault: providerConfig.fromVault
    ? providerConfigVaultPresenter({
        ...providerConfig.fromVault,
        provider: providerConfig.provider
      })
    : null,

  createdAt: providerConfig.createdAt,
  updatedAt: providerConfig.updatedAt
});

export let providerConfigPreviewPresenter = (
  providerConfig: ProviderConfig & {
    provider: Provider;
  }
) => ({
  object: 'provider.config#preview',

  id: providerConfig.id,

  isEphemeral: providerConfig.isEphemeral,
  isDefault: providerConfig.isDefault,

  name: providerConfig.name,
  description: providerConfig.description,
  metadata: providerConfig.metadata,

  providerId: providerConfig.provider.id,

  createdAt: providerConfig.createdAt,
  updatedAt: providerConfig.updatedAt
});
