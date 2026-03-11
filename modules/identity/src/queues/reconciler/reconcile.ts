import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../../../agent/src/env';

export let reconcileQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/reconcile',
  redisUrl: env.service.REDIS_URL
});

let lock = createLock({
  redisUrl: env.service.REDIS_URL,
  name: 'sub/idn/reconcile/lock'
});

export let reconcileQueueProcessor = reconcileQueue.process(data =>
  lock.usingLock(data.identityId, async () => {
    let identity = await db.identity.findUnique({
      where: { id: data.identityId },
      include: { tenant: true }
    });
    if (!identity) throw new QueueRetryError();
  })
);
