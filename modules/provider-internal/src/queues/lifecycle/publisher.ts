import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let publisherCreatedQueue = createQueue<{ publisherId: string }>({
  name: 'pint/lc/publisher/created',
  redisUrl: env.service.REDIS_URL
});

export let publisherCreatedQueueProcessor = publisherCreatedQueue.process(async data => {});

export let publisherUpdatedQueue = createQueue<{ publisherId: string }>({
  name: 'pint/lc/publisher/updated',
  redisUrl: env.service.REDIS_URL
});

export let publisherUpdatedQueueProcessor = publisherUpdatedQueue.process(async data => {});
