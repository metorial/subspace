import { combineQueueProcessors } from '@lowerdeck/queue';

export * from './lib/checkTenant';
export * from './services';

export let tenantProcessor = combineQueueProcessors([]);
