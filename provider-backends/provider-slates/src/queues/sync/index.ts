import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncChangeNotificationsQueueProcessor } from './changeNotifications';
import { syncChangeNotificationsCron } from './cron';
import { syncSlateVersionQueueProcessor } from './syncSlateVersion';

export let syncQueues = combineQueueProcessors([
  syncChangeNotificationsQueueProcessor,
  syncChangeNotificationsCron,
  syncSlateVersionQueueProcessor
]);
