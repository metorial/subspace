import type {
  CustomProvider,
  Provider,
  ProviderEntry,
  ProviderSpecification,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '@metorial-subspace/db';
import { providerPresenter } from './provider';

export let customProviderPresenter = (
  customProvider: CustomProvider & {
    provider:
      | (Provider & {
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
        })
      | null;
  }
) => ({
  object: 'custom_provider',

  id: customProvider.id,
  status: customProvider.status,

  name: customProvider.name,
  description: customProvider.description,
  metadata: customProvider.metadata,

  provider: providerPresenter(customProvider.provider!),

  createdAt: customProvider.createdAt,
  updatedAt: customProvider.updatedAt
});
