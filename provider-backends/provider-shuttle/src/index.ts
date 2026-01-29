import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncQueues } from './queues/sync';

export let shuttleProviderQueues = combineQueueProcessors([syncQueues]);

export * from './impl';
