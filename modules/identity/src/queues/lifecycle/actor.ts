import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexIdentityActorQueue } from '../search/actor';

export let identityActorCreatedQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/dep/lc/identityActor/created',
  redisUrl: env.service.REDIS_URL
});

export let identityActorCreatedQueueProcessor = identityActorCreatedQueue.process(
  async data => {
    await indexIdentityActorQueue.add({ identityActorId: data.identityActorId });
  }
);

export let identityActorUpdatedQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/dep/lc/identityActor/updated',
  redisUrl: env.service.REDIS_URL
});

export let identityActorUpdatedQueueProcessor = identityActorUpdatedQueue.process(
  async data => {
    await indexIdentityActorQueue.add({ identityActorId: data.identityActorId });
  }
);
