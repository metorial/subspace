import type {
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  SessionProvider
} from '@metorial-subspace/db';
import { providerAuthConfigPreviewPresenter } from './authConfig';
import { providerConfigPreviewPresenter } from './config';
import { providerDeploymentPreviewPresenter } from './deployment';

export let sessionProviderPresenter = (
  provider: SessionProvider & {
    provider: Provider;
    deployment: ProviderDeployment;
    config: ProviderConfig;
    authConfig: ProviderAuthConfig | null;
  }
) => ({
  object: 'session.provider',

  id: provider.id,
  status: provider.status,

  usage: {
    totalProductiveClientMessageCount: provider.totalProductiveClientMessageCount,
    totalProductiveServerMessageCount: provider.totalProductiveServerMessageCount
  },

  providerId: provider.provider.id,

  deployment: providerDeploymentPreviewPresenter({
    ...provider.deployment,
    provider: provider.provider
  }),

  config: providerConfigPreviewPresenter({
    ...provider.config,
    provider: provider.provider
  }),

  authConfig: provider.authConfig
    ? providerAuthConfigPreviewPresenter({
        ...provider.authConfig,
        provider: provider.provider
      })
    : null,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
