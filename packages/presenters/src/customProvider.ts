import type {
  CustomProvider,
  Provider,
  ProviderEntry,
  ProviderSpecification,
  ProviderType,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  ScmRepo,
  Tenant
} from '@metorial-subspace/db';
import { providerPresenter } from './provider';
import { scmRepositoryPresenter } from './scmRepository';

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

          type: ProviderType;
        })
      | null;

    scmRepo: ScmRepo | null;
  },
  d: { tenant: Tenant }
) => ({
  object: 'custom_provider',

  id: customProvider.id,
  status: customProvider.status,

  name: customProvider.name,
  description: customProvider.description,
  metadata: customProvider.metadata,

  scmRepo: customProvider.scmRepo ? scmRepositoryPresenter(customProvider.scmRepo) : undefined,

  provider: customProvider.provider
    ? providerPresenter(customProvider.provider, d)
    : undefined,

  createdAt: customProvider.createdAt,
  updatedAt: customProvider.updatedAt
});
