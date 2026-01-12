import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderOAuthSetup
} from '../../prisma/generated/client';
import { providerAuthConfigPresenter } from './authConfig';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerAuthMethodPresenter } from './providerAuthMethod';

export let providerOAuthSetupPresenter = (
  providerOAuthSetup: ProviderOAuthSetup & {
    provider: Provider;
    deployment: ProviderDeployment | null;
    authCredentials: ProviderAuthCredentials | null;
    authMethod: ProviderAuthMethod;
    authConfig: (ProviderAuthConfig & { deployment: ProviderDeployment | null }) | null;
  }
) => ({
  object: 'provider.oauth_setup',

  id: providerOAuthSetup.id,
  status: providerOAuthSetup.status,

  isEphemeral: providerOAuthSetup.isEphemeral,

  providerId: providerOAuthSetup.provider.id,

  name: providerOAuthSetup.name,
  description: providerOAuthSetup.description,
  metadata: providerOAuthSetup.metadata,

  redirectUrl: providerOAuthSetup.redirectUrl,

  authConfig: providerOAuthSetup.authConfig
    ? providerAuthConfigPresenter({
        ...providerOAuthSetup.authConfig,
        provider: providerOAuthSetup.provider,
        authCredentials: providerOAuthSetup.authCredentials,
        authMethod: providerOAuthSetup.authMethod
      })
    : null,

  credentials: providerOAuthSetup.authCredentials
    ? providerAuthCredentialsPresenter({
        ...providerOAuthSetup.authCredentials,
        provider: providerOAuthSetup.provider
      })
    : null,

  authMethod: providerAuthMethodPresenter({
    ...providerOAuthSetup.authMethod,
    provider: providerOAuthSetup.provider
  })
});
