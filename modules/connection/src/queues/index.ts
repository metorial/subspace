import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireSessionConnectionsCron } from './connectionCleanup/expireSessionConnections';
import { expireSessionsCron } from './connectionCleanup/expireSessions';
import { createErrorQueueProcessor } from './error/createError';
import { messageCreatedQueueProcessor } from './message/messageCreated';
import { offloadQueues } from './message/offloadMessage';
import { postprocessMessageQueueProcessor } from './message/postprocessMessage';

export let queues = combineQueueProcessors([
  expireSessionConnectionsCron,
  expireSessionsCron,
  postprocessMessageQueueProcessor,
  offloadQueues,
  createErrorQueueProcessor,
  messageCreatedQueueProcessor
]);
