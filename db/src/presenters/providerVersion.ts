import type { ProviderVersion } from '../../prisma/generated/browser';
import type { Provider, ProviderSpecification } from '../../prisma/generated/client';

export let providerVersionPresenter = (
  providerVersion: ProviderVersion & {
    provider: Provider;
    specification: Omit<ProviderSpecification, 'value'> | null;
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

  specificationId: providerVersion.specification?.id || null,

  createdAt: providerVersion.createdAt,
  updatedAt: providerVersion.updatedAt
});
