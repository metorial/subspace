import { Service } from '@lowerdeck/service';
import { callbackReconcileQueue } from '../queues/reconcile';

class callbackRegistrationServiceImpl {
  async enqueueConfigSync(d: { callbackId: string }) {
    await callbackReconcileQueue.add({
      callbackId: d.callbackId,
      scope: 'config'
    });
  }

  async enqueueBindingReconcile(d: {
    callbackId?: string;
    providerDeploymentConfigPairId?: string;
  }) {
    await callbackReconcileQueue.add({
      ...d,
      scope: 'bindings'
    });
  }

  async enqueueReconcile(d: {
    callbackId?: string;
    providerDeploymentConfigPairId?: string;
  }) {
    await callbackReconcileQueue.add({
      ...d,
      scope: 'all'
    });
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
