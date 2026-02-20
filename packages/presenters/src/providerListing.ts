import type {
  Provider,
  ProviderEntry,
  ProviderListing,
  ProviderListingCategory,
  ProviderListingCollection,
  ProviderListingGroup,
  ProviderSpecification,
  ProviderType,
  ProviderVariant,
  ProviderVersion,
  Publisher,
  Tenant
} from '@metorial-subspace/db';
import { providerPresenter } from './provider';
import { providerListingCategoryPresenter } from './providerListingCategory';
import { providerListingCollectionPresenter } from './providerListingCollection';
import { providerListingGroupPresenter } from './providerListingGroup';
import { publisherPresenter } from './publisher';

let toOptionalString = (value: string | null | undefined): string | null => {
  let normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

let toGithubIdentityFromUrl = (
  sourceUrl: string | null | undefined
): { owner: string; repo: string } | null => {
  let normalizedUrl = toOptionalString(sourceUrl);
  if (!normalizedUrl) return null;

  try {
    let parsed = new URL(normalizedUrl);
    let [owner, repo] = parsed.pathname.split('/').filter(Boolean).slice(0, 2);

    if (!owner || !repo) return null;

    return { owner, repo };
  } catch {
    // Ignore malformed source URLs.
    return null;
  }
};

let toGithubRepository = (source: PrismaJson.PublisherSource | null | undefined) => {
  if (!source || source.type !== 'github') return null;

  let sourceIdentity = toGithubIdentityFromUrl(source.url);
  let owner = toOptionalString(source.owner) ?? sourceIdentity?.owner ?? null;
  let repo = toOptionalString(source.repo) ?? sourceIdentity?.repo ?? null;

  if (!owner || !repo) return null;
  let identifier = `${owner}/${repo}`;

  return {
    object: 'provider.repository' as const,
    provider: 'github' as const,
    identifier,
    providerUrl: `https://github.com/${identifier}`,
    defaultBranch: toOptionalString(source.defaultBranch) ?? 'main',
    stargazersCount: source.stargazersCount ?? null,
    watchersCount: source.watchersCount ?? null,
    forksCount: source.forksCount ?? null,
    license: source.license ?? null
  };
};

export let providerListingPresenter = (
  providerListing: Omit<ProviderListing, 'readme'> & {
    publisher: Publisher;
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
    };

    categories?: ProviderListingCategory[];
    collections?: ProviderListingCollection[];
    groups?: ProviderListingGroup[];
  } & {
    readme?: string | null;
  },
  d: { tenant: Tenant }
) => ({
  object: 'provider.listing',

  id: providerListing.id,

  isPublic: providerListing.isPublic,
  isCustomized: providerListing.isCustomized,

  isMetorial: providerListing.isMetorial,
  isVerified: providerListing.isVerified,
  isOfficial: providerListing.isOfficial,

  name: providerListing.name,
  description: providerListing.description,
  slug: providerListing.slug,
  image: providerListing.image,

  readme: providerListing.readme ?? null,
  skills: providerListing.skills,

  rank: providerListing.rank,

  deploymentsCount: providerListing.deploymentsCount,
  providerSessionsCount: providerListing.providerSessionsCount,
  providerMessagesCount: providerListing.providerMessagesCount,

  publisher: publisherPresenter(providerListing.publisher),
  repository: toGithubRepository(providerListing.publisher.source),

  provider: providerPresenter(providerListing.provider, d),

  categories: (providerListing.categories ?? []).map(category =>
    providerListingCategoryPresenter(category)
  ),
  collections: (providerListing.collections ?? []).map(category =>
    providerListingCollectionPresenter(category)
  ),
  groups: (providerListing.groups ?? []).map(category =>
    providerListingGroupPresenter(category)
  ),

  createdAt: providerListing.createdAt,
  updatedAt: providerListing.updatedAt
});
