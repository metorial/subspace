import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { customDeploymentMonitorQueue } from '../deployment/monitor';

export let customProviderDeploymentCreatedQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'cpr/lc/customProviderDeployment/created',
  redisUrl: env.service.REDIS_URL
});

export let customProviderDeploymentCreatedQueueProcessor =
  customProviderDeploymentCreatedQueue.process(async data => {
    await customDeploymentMonitorQueue.add({
      customProviderDeploymentId: data.customProviderDeploymentId
    });
  });
