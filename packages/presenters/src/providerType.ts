import type { ProviderType, Tenant } from '@metorial-subspace/db';
import { env } from './env';

let mapAuth = (
  auth: ProviderType['attributes']['auth'],
  providerType: ProviderType,
  tenant: Tenant
) => {
  if (auth.status == 'disabled') return auth;

  return {
    ...auth,
    oauth:
      auth.oauth.status == 'enabled'
        ? {
            ...auth.oauth,
            oauthCallbackUrl: `${env.service.PUBLIC_SERVICE_URL}/oauth-callback/${tenant.urlKey}/${providerType.shortKey}`
          }
        : auth.oauth
  };
};

export let providerTypePresenter = (providerType: ProviderType, d: { tenant: Tenant }) => ({
  object: 'provider.type',

  id: providerType.id,
  name: providerType.name,

  config: providerType.attributes.config,
  triggers: providerType.attributes.triggers,
  auth: mapAuth(providerType.attributes.auth, providerType, d.tenant),

  createdAt: providerType.createdAt
});
