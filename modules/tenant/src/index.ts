import { combineQueueProcessors } from '@lowerdeck/queue';

export * from './services';

export let tenantProcessor = combineQueueProcessors([]);
