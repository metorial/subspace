import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Tenant } from '@metorial-subspace/db';

let include = {};

class publisherServiceImpl {
  async getPublisherById(d: { publisherId: string; tenant: Tenant }) {
    let publisher = await db.publisher.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.publisherId },
              { identifier: d.publisherId },
              { tenant: { id: d.publisherId } },
              { tenant: { identifier: d.publisherId } }
            ]
          },

          {
            OR: [
              { type: 'metorial' as const },
              { type: 'external' as const },
              { type: 'tenant' as const, tenantOid: d.tenant.oid }
            ]
          }
        ]
      },
      include
    });
    if (!publisher) {
      throw new ServiceError(notFoundError('publisher', d.publisherId));
    }

    return publisher;
  }

  async listPublishers(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.publisher.findMany({
            ...opts,
            where: {
              OR: [
                { type: 'metorial' as const },
                { type: 'external' as const },
                { type: 'tenant' as const, tenantOid: d.tenant.oid }
              ]
            },
            include
          })
      )
    );
  }
}

export let publisherService = Service.create(
  'publisherService',
  () => new publisherServiceImpl()
).build();
