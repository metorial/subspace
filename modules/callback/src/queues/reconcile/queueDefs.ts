import { createQueue } from '@lowerdeck/queue';
import { callbackRegistrationReconcileQueue as callbackReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { env } from '../../env';

export { callbackReconcileQueue };

export let callbackReconcilePairQueue = createQueue<{
  callbackId: string;
  providerDeploymentConfigPairId: string;
}>({
  name: 'sub/callback/reconcile/pair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

export let callbackSharedTriggerConfigSyncQueue = createQueue<{
  callbackId: string;
}>({
  name: 'sub/callback/reconcile/shared-config',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let callbackReconcilePairsPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/pairs/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let callbackReconcilePairTriggerQueue = createQueue<{
  callbackId: string;
  pairId: string;
  callbackTriggerId: string;
}>({
  name: 'sub/callback/reconcile/pair-trigger',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 30,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

export let callbackReconcilePairRegistrationsPageQueue = createQueue<{
  callbackId: string;
  providerDeploymentConfigPairId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/pair/registrations/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

export let callbackReconcileRegistrationsPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/registrations/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let callbackReconcileRegistrationAuditQueue = createQueue<{
  registrationId: string;
}>({
  name: 'sub/callback/reconcile/registration/audit',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});
