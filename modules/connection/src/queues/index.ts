import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireSessionConnectionsQueues } from './connectionCleanup/expireSessionConnections';
import { expireSessionsCron } from './connectionCleanup/expireSessions';
import { createErrorQueueProcessor } from './error/createError';
import { messageCreatedQueueProcessor } from './message/messageCreated';
import { offloadQueues } from './message/offloadMessage';
import { postprocessMessageQueueProcessor } from './message/postprocessMessage';
import { stopProviderRunsCron } from './provderRun/stopProviderRuns';

export let queues = combineQueueProcessors([
  expireSessionConnectionsQueues,
  expireSessionsCron,
  postprocessMessageQueueProcessor,
  offloadQueues,
  createErrorQueueProcessor,
  messageCreatedQueueProcessor,
  stopProviderRunsCron
]);
