import { createCron } from '@lowerdeck/cron';
import { env } from '../../env';
import { syncChangeNotificationsQueue } from './changeNotifications';

export let syncChangeNotificationsCron = createCron(
  {
    name: 'kst/slt/cnhnotif/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '* * * * *'
  },
  async () => {
    await syncChangeNotificationsQueue.add({});
  }
);
