import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  db,
  getId,
  ProviderListing,
  ProviderListingGroup,
  Tenant
} from '@metorial-subspace/db';

class ProviderListingGroupService {
  async getProviderListingGroupById(d: { tenant: Tenant; providerListingGroupId: string }) {
    let providerListingGroup = await db.providerListingGroup.findFirst({
      where: {
        OR: [{ id: d.providerListingGroupId }, { slug: d.providerListingGroupId }]
      }
    });
    if (!providerListingGroup) {
      throw new ServiceError(notFoundError('provider_collection', d.providerListingGroupId));
    }

    return providerListingGroup;
  }

  async listProviderListingGroups(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid
            }
          })
      )
    );
  }

  async createProviderListingGroup(d: {
    tenant: Tenant;
    input: { name: string; description?: string };
  }) {
    return await db.providerListingGroup.create({
      data: {
        ...getId('providerGroup'),
        tenantOid: d.tenant.oid,
        name: d.input.name,
        description: d.input.description,
        slug: slugify(`${d.input.name}-${generateCode(6)}`)
      }
    });
  }

  async updateProviderListingGroup(d: {
    providerListingGroup: ProviderListingGroup;
    input: {
      name?: string;
      description?: string;
    };
  }) {
    return await db.providerListingGroup.update({
      where: { id: d.providerListingGroup.id },
      data: {
        name: d.input.name,
        description: d.input.description
      }
    });
  }

  async addProviderToGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing;
  }) {
    await db.providerListing.update({
      where: { id: d.providerListing.id },
      data: {
        collections: {
          connect: { id: d.providerListingGroup.id }
        }
      },
      include: {
        collections: true
      }
    });
  }

  async removeProviderFromGroup(d: {
    providerListingGroup: ProviderListingGroup;
    providerListing: ProviderListing;
  }) {
    return db.providerListing.update({
      where: { id: d.providerListing.id },
      data: {
        collections: {
          disconnect: { id: d.providerListingGroup.id }
        }
      }
    });
  }
}

export let providerListingGroupService = Service.create(
  'providerListingGroupService',
  () => new ProviderListingGroupService()
).build();
