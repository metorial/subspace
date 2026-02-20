import { randomBytes } from 'crypto';
import { get4ByteIntId, getId } from '@metorial-subspace/db';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';
import { beforeEach, describe, expect, it } from 'vitest';

describe('public-provider-resources.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('allows listing public resources without tenant/environment', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-solution'
    });

    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let listings = await client.providerListing.list({
      isPublic: true,
      limit: 1
    });
    expect(listings).toMatchObject({
      __typename: 'list'
    });

    let categories = await client.providerListingCategory.list({
      limit: 1
    });
    expect(categories).toMatchObject({
      __typename: 'list'
    });

    let collections = await client.providerListingCollection.list({
      limit: 1
    });
    expect(collections).toMatchObject({
      __typename: 'list'
    });
  });

  it('exposes publisher and repository metadata on provider listings', async () => {
    let f = fixtures(testDb);
    let suffix = randomBytes(4).toString('hex');

    let solution = await f.solution.default({
      identifier: `provider-metadata-solution-${suffix}`,
      name: `Provider Metadata Solution ${suffix}`
    });
    let tenant = await f.tenant.default({
      identifier: `provider-metadata-tenant-${suffix}`,
      name: `Provider Metadata Tenant ${suffix}`
    });
    let environment = await f.environment.default({
      tenant,
      overrides: {
        identifier: `provider-metadata-dev-${suffix}`,
        name: 'Provider Metadata Dev'
      }
    });

    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let publisherTag = await testDb.providerTag.create({
      data: {
        ...getId('providerTag'),
        tag: `pub-${suffix}`
      }
    });

    let providerTag = await testDb.providerTag.create({
      data: {
        ...getId('providerTag'),
        tag: `pro-${suffix}`
      }
    });

    let publisher = await testDb.publisher.create({
      data: {
        ...getId('publisher'),
        type: 'external',
        identifier: `ext::github::acme-${suffix}`,
        name: `Acme ${suffix}`,
        description: 'Acme publisher fixture',
        tag: publisherTag.tag,
        source: {
          type: 'github',
          url: 'https://github.com/acme/awesome-mcp',
          owner: 'acme',
          repo: 'awesome-mcp',
          defaultBranch: 'develop',
          stargazersCount: 4242,
          watchersCount: 321,
          forksCount: 77,
          license: 'Apache-2.0'
        }
      }
    });

    let entry = await testDb.providerEntry.create({
      data: {
        ...getId('providerEntry'),
        identifier: `provider-entry-${suffix}`,
        name: 'Awesome MCP',
        description: 'Provider entry fixture',
        publisherOid: publisher.oid
      }
    });

    let providerType = await testDb.providerType.create({
      data: {
        oid: get4ByteIntId(),
        id: getId('providerType').id,
        shortKey: `test-${suffix}`,
        identifier: `test-provider-type-${suffix}`,
        name: `Test Provider Type ${suffix}`,
        attributes: {
          provider: 'metorial-shuttle',
          backend: 'mcp.remote',
          triggers: { status: 'disabled' },
          auth: { status: 'disabled' },
          config: { status: 'disabled' }
        }
      }
    });

    let provider = await testDb.provider.create({
      data: {
        ...getId('provider'),
        access: 'public',
        status: 'active',
        identifier: `provider-${suffix}`,
        slug: `awesome-mcp-${suffix}`,
        globalIdentifier: null,
        name: 'Awesome MCP',
        description: 'Provider fixture',
        tag: providerTag.tag,
        entryOid: entry.oid,
        publisherOid: publisher.oid,
        typeOid: providerType.oid,
        ownerTenantOid: null,
        ownerSolutionOid: null
      }
    });

    let providerListing = await testDb.providerListing.create({
      data: {
        ...getId('providerListing'),
        status: 'active',
        isPublic: true,
        isCustomized: false,
        isMetorial: false,
        isVerified: true,
        isOfficial: false,
        name: 'Awesome MCP Listing',
        slug: `awesome-mcp-listing-${suffix}`,
        description: 'Listing fixture',
        readme: '# Fixture',
        skills: ['tools', 'search'],
        rank: 10,
        deploymentsCount: 12,
        providerSessionsCount: 34,
        providerMessagesCount: 56,
        publisherOid: publisher.oid,
        providerOid: provider.oid
      }
    });

    let listing = await client.providerListing.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      providerListingId: providerListing.id
    });

    expect(listing).toMatchObject({
      id: providerListing.id,
      publisher: {
        id: publisher.id,
        identifier: publisher.identifier,
        name: publisher.name
      },
      repository: {
        object: 'provider.repository',
        provider: 'github',
        identifier: 'acme/awesome-mcp',
        providerUrl: 'https://github.com/acme/awesome-mcp',
        defaultBranch: 'develop',
        stargazersCount: 4242,
        watchersCount: 321,
        forksCount: 77,
        license: 'Apache-2.0'
      }
    });

    let listings = await client.providerListing.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      isPublic: true,
      limit: 20
    });

    let item = listings.items.find(i => i.id === providerListing.id);

    expect(item).toBeDefined();
    expect(item).toMatchObject({
      id: providerListing.id,
      repository: {
        identifier: 'acme/awesome-mcp',
        defaultBranch: 'develop',
        stargazersCount: 4242,
        watchersCount: 321,
        forksCount: 77,
        license: 'Apache-2.0'
      }
    });
  });
});
