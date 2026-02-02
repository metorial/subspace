import { createVoyagerClient } from '@metorial-services/voyager-client';
import { env } from './env';

let getIndexName = (suffix?: string) =>
  [env.service.VOYAGER_INDEX_PREFIX, 'subspace', suffix].filter(Boolean).join('_');

export let voyager = createVoyagerClient({
  endpoint: env.service.VOYAGER_URL
});

export let voyagerSource = await voyager.source.upsert({
  name: 'Subspace',
  identifier: getIndexName()
});

export let voyagerIndex = {
  providerListing: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_listing'),
    name: 'Provider Listings'
  }),

  publisher: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('publisher'),
    name: 'Publishers'
  }),

  providerConfig: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_config'),
    name: 'Provider Configs'
  }),

  providerConfigVault: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_config_vault'),
    name: 'Provider Config Vaults'
  }),

  providerDeployment: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_deployment'),
    name: 'Provider Deployments'
  }),

  providerAuthCredentials: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_auth_credentials'),
    name: 'Provider Auth Credentials'
  }),

  providerAuthConfig: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('provider_auth_config'),
    name: 'Provider Auth Configs'
  }),

  customProvider: await voyager.index.upsert({
    sourceId: voyagerSource.id,
    identifier: getIndexName('custom_provider'),
    name: 'Custom Providers'
  })
};
