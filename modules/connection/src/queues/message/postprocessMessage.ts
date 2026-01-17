import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { differenceInMinutes } from 'date-fns';
import { env } from '../../env';

export let postprocessMessageQueue = createQueue<{ messageId: string }>({
  name: 'con/msg/post',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let postprocessMessageQueueProcessor = postprocessMessageQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId }
  });
  if (!message) throw new QueueRetryError();

  if (message.status == 'waiting_for_response') {
    let createdAgo = Math.abs(differenceInMinutes(new Date(), message.createdAt));

    if (createdAgo >= 5) {
      await db.sessionMessage.update({
        where: { id: message.id },
        data: {
          failureReason: 'timeout',
          status: 'failed',
          completedAt: new Date(),
          output: {
            type: 'error',
            data: {
              code: 'timeout',
              message: 'The message failed to receive a response from the provider.'
            }
          }
        }
      });

      return;
    }

    await postprocessMessageQueue.add(data, { delay: 1000 * 60, id: data.messageId });
  }
});
