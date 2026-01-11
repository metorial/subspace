import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexProviderDeploymentQueue } from '../search/providerDeployment';

export let providerDeploymentCreatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'dep/lc/providerDeployment/created',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentCreatedQueueProcessor = providerDeploymentCreatedQueue.process(
  async data => {
    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
  }
);

export let providerDeploymentUpdatedQueue = createQueue<{ providerDeploymentId: string }>({
  name: 'dep/lc/providerDeployment/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentUpdatedQueueProcessor = providerDeploymentUpdatedQueue.process(
  async data => {
    await indexProviderDeploymentQueue.add({
      providerDeploymentId: data.providerDeploymentId
    });
  }
);
