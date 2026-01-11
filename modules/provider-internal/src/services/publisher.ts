import { canonicalize } from '@lowerdeck/canonicalize';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { createTag } from '../lib/createTag';
import { publisherCreatedQueue, publisherUpdatedQueue } from '../queues/lifecycle/publisher';

let include = {};

class publisherInternalServiceImpl {
  async upsertPublisher(d: {
    owner: { type: 'tenant'; tenant: Tenant } | { type: 'metorial' } | { type: 'external' };
    input: {
      name: string;
      identifier: string;
      description?: string;
      source?: PrismaJson.PublisherSource;
    };
  }) {
    let publisher = await db.publisher.findFirst({
      where: {
        identifier: d.input.identifier,
        tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
      }
    });
    if (
      publisher &&
      publisher.name === d.input.name &&
      publisher.description === d.input.description &&
      (publisher.source == d.input.source ||
        canonicalize(publisher.source) === canonicalize(d.input.source))
    ) {
      return publisher;
    }

    return withTransaction(async db => {
      let newId = getId('publisher');

      let publisher = await db.publisher.upsert({
        where: {
          identifier: d.input.identifier,
          tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
        },
        create: {
          ...newId,

          tag: await createTag(),

          type: d.owner.type,

          name: d.input.name,
          identifier: d.input.identifier,
          description: d.input.description,

          source: d.input.source,

          tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
        },
        update: {
          name: d.input.name,
          description: d.input.description,
          source: d.input.source
        }
      });

      await addAfterTransactionHook(async () => {
        if (publisher.id == newId.id) {
          await publisherCreatedQueue.add({ publisherId: publisher.id });
        } else {
          await publisherUpdatedQueue.add({ publisherId: publisher.id });
        }
      });

      return publisher;
    });
  }
}

export let publisherInternalService = Service.create(
  'publisherInternalService',
  () => new publisherInternalServiceImpl()
).build();
