import { combineQueueProcessors } from '@lowerdeck/queue';
import { callbackRegistrationReconcileQueueProcessor } from './reconcile';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackRegistrationReconcileQueueProcessor
]);
