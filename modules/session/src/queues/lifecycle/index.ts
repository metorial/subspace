import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  sessionArchivedQueueProcessor,
  sessionCreatedQueueProcessor,
  sessionDeletedQueueProcessor,
  sessionUpdatedQueueProcessor
} from './session';

export let lifecycleQueues = combineQueueProcessors([
  sessionCreatedQueueProcessor,
  sessionUpdatedQueueProcessor,
  sessionArchivedQueueProcessor,
  sessionDeletedQueueProcessor
]);
