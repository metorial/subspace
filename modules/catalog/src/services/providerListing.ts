import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Solution, Tenant } from '@metorial-subspace/db';
import { providerInclude } from './provider';

let getInclude = (tenant: Tenant, solution: Solution) => ({
  categories: true,
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
      throw new ServiceError(notFoundError('provider_listing', d.providerListingId));
    }

    return providerListing;
  }

  async listProviderListings(d: {
    search?: string;

    collectionIds?: string[];
    categoryIds?: string[];
    publisherIds?: string[];

    isPublic?: boolean;
    onlyFromTenant?: boolean;

    isVerified?: boolean;
    isOfficial?: boolean;
    isMetorial?: boolean;

    isHostable?: boolean;

    tenant: Tenant;
    solution: Solution;

    orderByRank?: boolean;
  }) {
    let collections =
      d.collectionIds && d.collectionIds.length > 0
        ? await db.providerListingCollection.findMany({
            where: { OR: [{ id: { in: d.collectionIds } }, { slug: { in: d.collectionIds } }] }
          })
        : undefined;
    let categories =
      d.categoryIds && d.categoryIds.length > 0
        ? await db.providerListingCategory.findMany({
            where: { OR: [{ id: { in: d.categoryIds } }, { slug: { in: d.categoryIds } }] }
          })
        : undefined;
    let publishers =
      d.publisherIds && d.publisherIds.length > 0
        ? await db.publisher.findMany({
            where: {
              OR: [{ id: { in: d.publisherIds } }, { identifier: { in: d.publisherIds } }]
            }
          })
        : undefined;

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        // let search = d.search
        //   ? await searchService.search<{ id: string }>({
        //       index: 'provider_listing',
        //       query: d.search,
        //       options: {
        //         limit: opts.take * 2
        //       }
        //     })
        //   : undefined;

        return await db.providerListing.findMany({
          ...opts,

          orderBy: d.orderByRank ? { rank: 'desc' } : opts.orderBy,

          where: {
            status: 'active',

            AND: [
              // {
              //   OR: [
              //     { id: { in: search?.map(s => s.id) } },
              //     { slug: { in: search?.map(s => s.id) } }
              //   ]
              // },

              collections
                ? {
                    collections: {
                      some: { oid: { in: collections?.map(c => c.oid) } }
                    }
                  }
                : {},

              categories
                ? {
                    categories: {
                      some: { oid: { in: categories?.map(c => c.oid) } }
                    }
                  }
                : {},
              publishers
                ? {
                    publisher: {
                      id: { in: publishers?.map(p => p.id) }
                    }
                  }
                : {},

              {
                OR: [
                  { isPublic: true },
                  { ownerTenantOid: d.tenant.oid, ownerSolutionOid: d.solution.oid }
                ]
              },

              d.onlyFromTenant
                ? {
                    ownerTenantOid: d.tenant?.oid ?? -1,
                    ownerSolutionOid: d.solution?.oid ?? -1
                  }
                : {},

              d.isPublic ? { isPublic: true } : {},

              d.isVerified !== undefined ? { isVerified: d.isVerified } : {},
              d.isOfficial !== undefined ? { isOfficial: d.isOfficial } : {},
              d.isMetorial !== undefined ? { isMetorial: d.isMetorial } : {}
            ]
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
