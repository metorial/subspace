import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveQueues } from './queues/archive';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export * from './services';

export let identityQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  deleteQueues,
  archiveQueues
]);
