import { combineQueueProcessors } from '@lowerdeck/queue';
import { expireSessionConnectionsCron } from './expireSessionConnections';
import { expireSessionsCron } from './expireSessions';
import { postprocessMessageQueueProcessor } from './postprocessMessage';

export let queues = combineQueueProcessors([
  expireSessionConnectionsCron,
  expireSessionsCron,
  postprocessMessageQueueProcessor
]);
