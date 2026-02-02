import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import {
  resolveProviderCategories,
  resolveProviderCollections,
  resolveProviderGroups,
  resolvePublishers
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { providerInclude } from './provider';

let getInclude = (tenant: Tenant, solution: Solution) => ({
  categories: true,
  collections: true,
  groups: {
    where: { tenantOid: tenant.oid, solutionOid: solution.oid }
  },

  publisher: true,

  provider: {
    include: providerInclude
  }
});

class ProviderListingService {
  async getProviderListingById(d: {
    providerListingId: string;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
  }) {
    let providerListing = await db.providerListing.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.providerListingId },
              { slug: d.providerListingId },
              { provider: { id: d.providerListingId } }
            ]
          },

          {
            OR: [
              { isPublic: true },
              { ownerTenantOid: d.tenant.oid, ownerSolutionOid: d.solution.oid }
            ]
          }
        ]
      },
      include: getInclude(d.tenant, d.solution)
    });
    if (!providerListing) {
      throw new ServiceError(notFoundError('provider.listing', d.providerListingId));
    }

    return providerListing;
  }

  async listProviderListings(d: {
    search?: string;

    ids?: string[];
    providerCollectionIds?: string[];
    providerCategoryIds?: string[];
    providerGroupIds?: string[];
    publisherIds?: string[];

    isPublic?: boolean;
    onlyFromTenant?: boolean;

    isVerified?: boolean;
    isOfficial?: boolean;
    isMetorial?: boolean;

    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    orderByRank?: boolean;
  }) {
    let collections = await resolveProviderCollections(d, d.providerCollectionIds);
    let categories = await resolveProviderCategories(d, d.providerCategoryIds);
    let groups = await resolveProviderGroups(d, d.providerGroupIds);
    let publishers = await resolvePublishers(d, d.publisherIds);

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let search = d.search
          ? await voyager.record.search({
              tenantId: d.tenant.id,
              sourceId: voyagerSource.id,
              indexId: voyagerIndex.providerListing.id,
              query: d.search
            })
          : null;

        return await db.providerListing.findMany({
          ...opts,

          orderBy: d.orderByRank ? { rank: 'desc' } : opts.orderBy,

          where: {
            status: 'active',

            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,

              search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

              {
                OR: [
                  { isPublic: true },
                  { ownerTenantOid: d.tenant.oid, ownerSolutionOid: d.solution.oid }
                ]
              },

              collections ? { collections: { some: collections.oidIn } } : undefined!,
              categories ? { categories: { some: categories.oidIn } } : undefined!,
              groups ? { groups: { some: groups.oidIn } } : undefined!,

              publishers ? { publisherOid: publishers.in } : undefined!,

              d.onlyFromTenant
                ? {
                    ownerTenantOid: d.tenant?.oid ?? -1,
                    ownerSolutionOid: d.solution?.oid ?? -1
                  }
                : undefined!,

              d.isPublic ? { isPublic: true } : undefined!,

              d.isVerified !== undefined ? { isVerified: d.isVerified } : undefined!,
              d.isOfficial !== undefined ? { isOfficial: d.isOfficial } : undefined!,
              d.isMetorial !== undefined ? { isMetorial: d.isMetorial } : undefined!
            ].filter(Boolean)
          },
          include: getInclude(d.tenant, d.solution),
          omit: {
            readme: true
          }
        });
      })
    );
  }
}

export let providerListingService = Service.create(
  'providerListingService',
  () => new ProviderListingService()
).build();
