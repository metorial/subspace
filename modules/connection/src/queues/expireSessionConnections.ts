import { createCron } from '@lowerdeck/cron';
import { db } from '@metorial-subspace/db';
import { subMinutes } from 'date-fns';
import { env } from '../env';

export let expireSessionConnectionsCron = createCron(
  {
    name: 'con/conn/expire',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    let twoMinutesAgo = subMinutes(new Date(), 2);

    await db.sessionConnection.updateMany({
      where: {
        state: 'connected',
        lastActiveAt: { lt: twoMinutesAgo }
      },
      data: {
        state: 'disconnected'
      }
    });
  }
);
