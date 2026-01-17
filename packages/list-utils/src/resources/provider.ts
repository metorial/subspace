import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveProviders = createResolver(async ({ ts, ids }) =>
  db.provider.findMany({
    where: {
      AND: [
        {
          OR: [
            { id: { in: ids } },
            { slug: { in: ids } },
            {
              listing: { id: { in: ids } }
            }
          ]
        },

        {
          OR: [
            { access: 'public' as const },
            {
              access: 'tenant' as const,
              ownerTenantOid: ts.tenantOid,
              ownerSolutionOid: ts.solutionOid
            }
          ]
        }
      ]
    },
    select: { oid: true }
  })
);

export let resolveProviderVersions = createResolver(async ({ ts, ids }) =>
  db.providerVersion.findMany({
    where: {
      id: { in: ids },

      provider: {
        OR: [
          { access: 'public' as const },
          {
            access: 'tenant' as const,
            ownerTenantOid: ts.tenantOid,
            ownerSolutionOid: ts.solutionOid
          }
        ]
      }
    },
    select: { oid: true }
  })
);

export let resolveProviderListings = createResolver(async ({ ts, ids }) =>
  db.providerListing.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { slug: { in: ids } },
        { provider: { id: { in: ids } } },
        { provider: { slug: { in: ids } } }
      ],

      provider: {
        OR: [
          { access: 'public' as const },
          {
            access: 'tenant' as const,
            ownerTenantOid: ts.tenantOid,
            ownerSolutionOid: ts.solutionOid
          }
        ]
      }
    },
    select: { oid: true }
  })
);

export let resolveProviderCollections = createResolver(async ({ ts, ids }) =>
  db.providerListingCollection.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderCategories = createResolver(async ({ ts, ids }) =>
  db.providerListingCategory.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderGroups = createResolver(async ({ ts, ids }) =>
  db.providerListingGroup.findMany({
    where: {
      tenantOid: ts.tenantOid,
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderSpecifications = createResolver(async ({ ts, ids }) =>
  db.providerSpecification.findMany({
    where: {
      provider: {
        OR: [
          { access: 'public' as const },
          {
            access: 'tenant' as const,
            ownerTenantOid: ts.tenantOid,
            ownerSolutionOid: ts.solutionOid
          }
        ]
      },

      id: { in: ids }
    },
    select: { oid: true }
  })
);

export let resolvePublishers = createResolver(async ({ ts, ids }) =>
  db.provider.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);
