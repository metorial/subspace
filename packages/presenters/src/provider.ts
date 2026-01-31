import type {
  Provider,
  ProviderEntry,
  ProviderSpecification,
  ProviderType,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '@metorial-subspace/db';
import { providerEntryPresenter } from './providerEntry';
import { providerTypePresenter } from './providerType';
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
          currentVersion:
            | (ProviderVersion & {
                specification: Omit<ProviderSpecification, 'value'> | null;
              })
            | null;
        })
      | null;

    type: ProviderType;
  },
  d: { tenant: Tenant }
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

  type: providerTypePresenter(provider.type, d),

  identifier: provider.identifier,

  tag: provider.tag,

  name: provider.name,
  description: provider.description,
  slug: provider.slug,
  metadata: provider.metadata,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
