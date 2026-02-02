import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { differenceInMinutes } from 'date-fns';
import { env } from '../../env';
import { completeMessage } from '../../shared/completeMessage';
import { upsertParticipant } from '../../shared/upsertParticipant';

export let postprocessMessageQueue = createQueue<{ messageId: string }>({
  name: 'sub/con/msg/post',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let postprocessMessageQueueProcessor = postprocessMessageQueue.process(async data => {
  let message = await db.sessionMessage.findFirst({
    where: { id: data.messageId },
    include: { session: true }
  });
  if (!message) throw new QueueRetryError();

  if (message.status === 'waiting_for_response') {
    let createdAgo = Math.abs(differenceInMinutes(new Date(), message.createdAt));

    if (createdAgo >= 5) {
      let responderParticipant = await upsertParticipant({
        session: message.session,
        from: { type: 'system' }
      });

      await completeMessage(
        { messageId: message.id },
        {
          responderParticipant,
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
      );

      return;
    }

    await postprocessMessageQueue.add(data, { delay: 1000 * 60, id: data.messageId });
  }
});
