import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  callbackReconcilePairQueueProcessor,
  callbackReconcilePairRegistrationsPageQueueProcessor,
  callbackReconcilePairTriggerQueueProcessor,
  callbackReconcilePairsPageQueueProcessor,
  callbackReconcileQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor
} from './reconcile';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackReconcileQueueProcessor,
  callbackReconcilePairQueueProcessor,
  callbackReconcilePairsPageQueueProcessor,
  callbackReconcilePairTriggerQueueProcessor,
  callbackReconcilePairRegistrationsPageQueueProcessor,
  callbackReconcileRegistrationsPageQueueProcessor,
  callbackReconcileRegistrationAuditQueueProcessor
]);
