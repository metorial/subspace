import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let providerAuthSessionCreatedQueue = createQueue<{
  providerAuthSessionId: string;
}>({
  name: 'auth/lc/providerAuthSession/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthSessionCreatedQueueProcessor = providerAuthSessionCreatedQueue.process(
  async data => {}
);

export let providerAuthSessionUpdatedQueue = createQueue<{
  providerAuthSessionId: string;
}>({
  name: 'auth/lc/providerAuthSession/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthSessionUpdatedQueueProcessor = providerAuthSessionUpdatedQueue.process(
  async data => {}
);
