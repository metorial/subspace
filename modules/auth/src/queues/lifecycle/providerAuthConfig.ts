import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexProviderAuthConfigQueue } from '../search/providerAuthConfig';

export let providerAuthConfigCreatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigCreatedQueueProcessor = providerAuthConfigCreatedQueue.process(
  async data => {
    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
  }
);

export let providerAuthConfigUpdatedQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/auth/lc/providerAuthConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthConfigUpdatedQueueProcessor = providerAuthConfigUpdatedQueue.process(
  async data => {
    await indexProviderAuthConfigQueue.add({
      providerAuthConfigId: data.providerAuthConfigId
    });
  }
);
