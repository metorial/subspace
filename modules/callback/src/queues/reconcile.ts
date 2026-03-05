import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { callbackRegistrationService } from '../services';
import { env } from '../env';

export let callbackRegistrationReconcileQueue = createQueue<{
  callbackId?: string;
  providerDeploymentConfigPairId?: string;
}>({
  name: 'sub/callback/reconcile',
  redisUrl: env.service.REDIS_URL
});

export let callbackRegistrationReconcileQueueProcessor =
  callbackRegistrationReconcileQueue.process(async data => {
    if (data.callbackId) {
      await callbackRegistrationService.reconcileCallback({ callbackId: data.callbackId });
      return;
    }

    if (data.providerDeploymentConfigPairId) {
      await callbackRegistrationService.reconcileForPair({
        providerDeploymentConfigPairId: data.providerDeploymentConfigPairId
      });
      return;
    }

    throw new QueueRetryError();
  });
