import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcilePairQueueProcessor,
  callbackReconcilePairRegistrationsPageQueueProcessor,
  callbackReconcilePairTriggerQueueProcessor,
  callbackReconcilePairsPageQueueProcessor,
  callbackReconcileQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor,
  callbackSharedTriggerConfigSyncQueueProcessor
} from './reconcile';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackSharedTriggerConfigSyncQueueProcessor,
  callbackReconcilePairQueueProcessor,
  callbackReconcilePairsPageQueueProcessor,
  callbackReconcilePairTriggerQueueProcessor,
  callbackReconcilePairRegistrationsPageQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor
]);
