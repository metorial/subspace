import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { postprocessMessageQueue } from './postprocessMessage';

export let messageCreatedQueue = createQueue<{ messageId: string }>({
  name: 'con/msg/created',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 25 }
});

export let messageCreatedQueueProcessor = messageCreatedQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId }
  });
  if (!message) throw new QueueRetryError();

  if (message.connectionOid) {
    await db.sessionConnection.updateMany({
      where: { oid: message.connectionOid },
      data: {
        lastActiveAt: new Date(),
        lastMessageAt: new Date(),
        totalProductiveClientMessageCount:
          message.isProductive && message.source === 'client' ? { increment: 1 } : undefined
      }
    });
  }

  if (message.sessionProviderOid) {
    await db.sessionProvider.updateMany({
      where: { oid: message.sessionProviderOid },
      data: {
        lastMessageAt: new Date(),
        totalProductiveClientMessageCount:
          message.isProductive && message.source === 'client' ? { increment: 1 } : undefined
      }
    });
  }

  await db.session.updateMany({
    where: { oid: message.sessionOid },
    data: {
      lastActiveAt: new Date(),
      lastMessageAt: new Date(),
      totalProductiveClientMessageCount:
        message.isProductive && message.source === 'client' ? { increment: 1 } : undefined
    }
  });

  await postprocessMessageQueue.add({ messageId: message.id }, { delay: 1000 * 10 });
});
