import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderDeployment
} from '../../prisma/generated/client';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerAuthMethodPresenter } from './providerAuthMethod';

export let providerAuthConfigPresenter = (
  providerAuthConfig: ProviderAuthConfig & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    authCredentials: ProviderAuthCredentials | null;
    authMethod: ProviderAuthMethod;
  }
) => ({
  object: 'provider.auth_config',

  id: providerAuthConfig.id,
  type: providerAuthConfig.type,

  isEphemeral: providerAuthConfig.isEphemeral,
  isDefault: providerAuthConfig.isDefault,

  providerId: providerAuthConfig.provider.id,

  name: providerAuthConfig.name,
  description: providerAuthConfig.description,
  metadata: providerAuthConfig.metadata,

  credentials: providerAuthConfig.authCredentials
    ? providerAuthCredentialsPresenter({
        ...providerAuthConfig.authCredentials,
        provider: providerAuthConfig.provider
      })
    : null,

  authMethod: providerAuthMethodPresenter({
    ...providerAuthConfig.authMethod,
    provider: providerAuthConfig.provider
  })
});
