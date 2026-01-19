import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Tenant } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';

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

  async listPublishers(d: { tenant: Tenant; search?: string }) {
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: voyagerSource.id,
          indexId: voyagerIndex.publisher.id,
          query: d.search
        })
      : null;

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
              ],

              id: search ? { in: search.map(r => r.documentId) } : undefined!
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
