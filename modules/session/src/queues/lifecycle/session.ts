import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let sessionCreatedQueue = createQueue<{ sessionId: string }>({
  name: 'ses/lc/session/created',
  redisUrl: env.service.REDIS_URL
});

export let sessionCreatedQueueProcessor = sessionCreatedQueue.process(async data => {});

export let sessionUpdatedQueue = createQueue<{ sessionId: string }>({
  name: 'ses/lc/session/updated',
  redisUrl: env.service.REDIS_URL
});

export let sessionUpdatedQueueProcessor = sessionUpdatedQueue.process(async data => {});
