import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  identityActorCreatedQueueProcessor,
  identityActorUpdatedQueueProcessor
} from './actor';
import { agentCreatedQueueProcessor, agentUpdatedQueueProcessor } from './agent';
import { identityCreatedQueueProcessor, identityUpdatedQueueProcessor } from './identity';

export let lifecycleQueues = combineQueueProcessors([
  identityCreatedQueueProcessor,
  identityUpdatedQueueProcessor,
  identityActorCreatedQueueProcessor,
  identityActorUpdatedQueueProcessor,
  agentCreatedQueueProcessor,
  agentUpdatedQueueProcessor
]);
