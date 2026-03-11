import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexIdentityQueue } from '../search/identity';

export let identityCreatedQueue = createQueue<{ identityId: string }>({
  name: 'sub/dep/lc/identity/created',
  redisUrl: env.service.REDIS_URL
});

export let identityCreatedQueueProcessor = identityCreatedQueue.process(async data => {
  await indexIdentityQueue.add({ identityId: data.identityId });

  // TODO: reconcile
});

export let identityUpdatedQueue = createQueue<{ identityId: string }>({
  name: 'sub/dep/lc/identity/updated',
  redisUrl: env.service.REDIS_URL
});

export let identityUpdatedQueueProcessor = identityUpdatedQueue.process(async data => {
  await indexIdentityQueue.add({ identityId: data.identityId });

  // TODO: reconcile
});
