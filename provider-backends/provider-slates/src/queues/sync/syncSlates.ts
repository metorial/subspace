import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { backend as slatesBackend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';
import { syncSlateVersionQueue } from './syncSlateVersion';

export let syncSlatesQueue = createQueue<{ cursor?: string }>({
  name: 'sub/slt/sync/many',
  redisUrl: env.service.REDIS_URL
});

let lock = createLock({
  name: 'sub/slt/sync/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncSlatesQueueProcessor = syncSlatesQueue.process(async data =>
  lock.usingLock(slatesBackend.id, async () => {
    let slatesList = await slates.slate.list({
      limit: 100,
      after: data.cursor,
      order: 'asc'
    });
    if (!slatesList.items.length) return;

    await syncSlateVersionQueue.addMany(
      slatesList.items
        .map(item => ({
          slateId: item.id,
          slateVersionId: item.currentVersion?.id!
        }))
        .filter(item => item.slateVersionId)
    );

    let lastItem = slatesList.items[slatesList.items.length - 1];
    if (!lastItem) return;

    await syncSlatesQueue.add({ cursor: lastItem.id }, { delay: 20 * 1000 });
  })
);
