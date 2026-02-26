import type {
  CodeBucket,
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
import type {
  ShuttleContainerRegistry,
  ShuttleContainerRepository,
  ShuttleContainerTag
} from '@metorial-subspace/provider-shuttle';
import { bucketPresenter } from './bucket';
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

    draftCodeBucket: (CodeBucket & { scmRepo: ScmRepo | null }) | null;

    containerTag?: ShuttleContainerTag;
    containerRegistry?: ShuttleContainerRegistry;
    containerRepository?: ShuttleContainerRepository;
    remoteUrl?: string;
    remoteProtocol?: 'sse' | 'streamable_http';
  },
  d: { tenant: Tenant }
) => ({
  object: 'custom_provider',

  id: customProvider.id,
  status: customProvider.status,

  name: customProvider.name,
  description: customProvider.description,
  metadata: customProvider.metadata,

  scmRepo: customProvider.scmRepo ? scmRepositoryPresenter(customProvider.scmRepo) : null,

  draftBucket: customProvider.draftCodeBucket
    ? bucketPresenter(customProvider.draftCodeBucket)
    : null,

  provider: customProvider.provider ? providerPresenter(customProvider.provider, d) : null,

  draft: {
    containerRegistry: customProvider.containerRegistry,
    containerRepository: customProvider.containerRepository,
    containerTag: customProvider.containerTag,

    remoteUrl: customProvider.remoteUrl,
    remoteProtocol: customProvider.remoteProtocol
  },

  createdAt: customProvider.createdAt,
  updatedAt: customProvider.updatedAt
});
