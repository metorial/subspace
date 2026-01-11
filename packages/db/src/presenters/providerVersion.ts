import type { ProviderVersion } from '../../prisma/generated/browser';
import type { Provider } from '../../prisma/generated/client';

export let providerVersionPresenter = (
  providerVersion: ProviderVersion & {
    provider: Provider;
  }
) => ({
  object: 'provider.version',

  id: providerVersion.id,

  tag: providerVersion.tag,
  identifier: providerVersion.identifier,

  isCurrent: providerVersion.isCurrent,

  name: providerVersion.name,
  description: providerVersion.description,

  metadata: providerVersion.metadata,

  createdAt: providerVersion.createdAt,
  updatedAt: providerVersion.updatedAt
});
