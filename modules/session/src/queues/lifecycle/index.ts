import { combineQueueProcessors } from '@lowerdeck/queue';
import { sessionCreatedQueueProcessor, sessionUpdatedQueueProcessor } from './session';

export let lifecycleQueues = combineQueueProcessors([
  sessionCreatedQueueProcessor,
  sessionUpdatedQueueProcessor
]);
