import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerVersionSetSpecificationQueueProcessor } from './setSpec';
import { providerVersionSyncSpecificationQueueProcessor } from './syncSpec';

export let versionQueues = combineQueueProcessors([
  providerVersionSyncSpecificationQueueProcessor,
  providerVersionSetSpecificationQueueProcessor
]);
