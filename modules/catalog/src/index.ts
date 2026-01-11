import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';

export * from './services';

export let catalogQueueProcessor = combineQueueProcessors([cleanupCron]);
