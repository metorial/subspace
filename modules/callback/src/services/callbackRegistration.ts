import { Service } from '@lowerdeck/service';
import { callbackReconcileQueue } from '../queues/reconcile';

class callbackRegistrationServiceImpl {
  async enqueueReconcile(d: { callbackId?: string; providerDeploymentConfigPairId?: string }) {
    await callbackReconcileQueue.add(d);
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
