import type {
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '../../prisma/generated/browser';
import type { Provider, ProviderEntry } from '../../prisma/generated/client';
import { providerEntryPresenter } from './providerEntry';
import { providerVariantPresenter } from './providerVariant';
import { providerVersionPresenter } from './providerVersion';
import { publisherPresenter } from './publisher';
import { tenantPresenter } from './tenant';

export let providerPresenter = (
  provider: Provider & {
    entry: ProviderEntry;
    publisher: Publisher;
    ownerTenant: Tenant | null;

    defaultVariant:
      | (ProviderVariant & {
          provider: Provider;
          currentVersion: ProviderVersion | null;
        })
      | null;
  }
) => ({
  object: 'provider',

  id: provider.id,
  access: provider.access,
  status: provider.status,

  ownerTenant: provider.ownerTenant ? tenantPresenter(provider.ownerTenant) : null,
  publisher: publisherPresenter(provider.publisher),
  entry: providerEntryPresenter(provider.entry),

  defaultVariant: provider.defaultVariant
    ? providerVariantPresenter({
        ...provider.defaultVariant,
        provider
      })
    : null,
  currentVersion: provider.defaultVariant?.currentVersion
    ? providerVersionPresenter({
        ...provider.defaultVariant.currentVersion,
        provider
      })
    : null,

  identifier: provider.identifier,

  tag: provider.tag,

  name: provider.name,
  description: provider.description,
  slug: provider.slug,
  metadata: provider.metadata,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
