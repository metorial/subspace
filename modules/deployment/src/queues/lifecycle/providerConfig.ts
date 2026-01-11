import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexProviderConfigQueue } from '../search/providerConfig';

export let providerConfigCreatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'dep/lc/providerConfig/created',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigCreatedQueueProcessor = providerConfigCreatedQueue.process(
  async data => {
    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });
  }
);

export let providerConfigUpdatedQueue = createQueue<{ providerConfigId: string }>({
  name: 'dep/lc/providerConfig/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerConfigUpdatedQueueProcessor = providerConfigUpdatedQueue.process(
  async data => {
    await indexProviderConfigQueue.add({ providerConfigId: data.providerConfigId });
  }
);
