import type {
  Provider,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  ProviderVariant,
  ProviderVersion
} from '../../prisma/generated/client';
import { providerConfigPreviewPresenter } from './config';
import { providerVersionPresenter } from './providerVersion';

export let providerDeploymentPresenter = (
  providerDeployment: ProviderDeployment & {
    provider: Provider;
    providerVariant: ProviderVariant;
    lockedVersion: (ProviderVersion & { specification: ProviderSpecification | null }) | null;
    defaultConfig: ProviderConfig | null;
  }
) => ({
  object: 'provider.deployment',

  id: providerDeployment.id,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,

  providerId: providerDeployment.provider.id,

  lockedVersion: providerDeployment.lockedVersion
    ? providerVersionPresenter({
        ...providerDeployment.lockedVersion,
        provider: providerDeployment.provider
      })
    : null,

  defaultConfig: providerDeployment.defaultConfig
    ? providerConfigPreviewPresenter({
        ...providerDeployment.defaultConfig,
        provider: providerDeployment.provider
      })
    : null,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});

export let providerDeploymentPreviewPresenter = (
  providerDeployment: ProviderDeployment & {
    provider: Provider;
  }
) => ({
  object: 'provider.deployment#preview',

  id: providerDeployment.id,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,

  providerId: providerDeployment.provider.id,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});
