import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderAuthSession,
  ProviderDeployment,
  ProviderSpecification
} from '../../prisma/generated/client';
import { env } from '../env';
import { providerAuthConfigPresenter } from './authConfig';
import { providerAuthCredentialsPresenter } from './authCredentials';
import { providerDeploymentPreviewPresenter } from './deployment';
import { providerAuthMethodPresenter } from './providerAuthMethod';

export let providerAuthSessionPresenter = (
  providerAuthSession: ProviderAuthSession & {
    authConfig:
      | (ProviderAuthConfig & {
          deployment: ProviderDeployment | null;
          authCredentials: ProviderAuthCredentials | null;
          authMethod: ProviderAuthMethod & {
            specification: Omit<ProviderSpecification, 'value'>;
          };
        })
      | null;
    deployment: ProviderDeployment | null;
    provider: Provider;
    authMethod: ProviderAuthMethod & { specification: Omit<ProviderSpecification, 'value'> };
    authCredentials: ProviderAuthCredentials | null;
  }
) => ({
  object: 'provider.auth_session',

  id: providerAuthSession.id,
  status: providerAuthSession.status,

  url: `${env.service.PUBLIC_SERVICE_URL}/auth-session/${providerAuthSession.id}?client_secret=${providerAuthSession.clientSecret}`,

  name: providerAuthSession.name,
  description: providerAuthSession.description,
  metadata: providerAuthSession.metadata,

  providerId: providerAuthSession.provider.id,

  authMethod: providerAuthMethodPresenter({
    ...providerAuthSession.authMethod,
    provider: providerAuthSession.provider
  }),

  deployment: providerAuthSession.deployment
    ? providerDeploymentPreviewPresenter({
        ...providerAuthSession.deployment,
        provider: providerAuthSession.provider
      })
    : null,

  credentials: providerAuthSession.authCredentials
    ? providerAuthCredentialsPresenter({
        ...providerAuthSession.authCredentials,
        provider: providerAuthSession.provider
      })
    : null,

  authConfig: providerAuthSession.authConfig
    ? providerAuthConfigPresenter({
        ...providerAuthSession.authConfig,
        provider: providerAuthSession.provider
      })
    : null,

  createdAt: providerAuthSession.createdAt,
  updatedAt: providerAuthSession.updatedAt
});
