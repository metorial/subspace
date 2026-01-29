import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncQueues } from './queues/sync';

export let slatesProviderQueues = combineQueueProcessors([syncQueues]);

export * from './impl';
