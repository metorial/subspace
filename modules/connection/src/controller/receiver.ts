import { db } from '@metorial-subspace/db';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../const';
import { Store } from '../lib/store';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { WireInput } from '../types/wireMessage';

export let startController = () => {
  let receiver = wire.createWireReceiver(async ctx => {
    console.log('Connection Controller received message on topic:', ctx.topic);

    let topic = topics.decode(ctx.topic);
    if (!topic) {
      console.warn(`Received message on invalid topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let instance = await db.sessionProviderInstance.findFirst({
      where: { oid: topic.instanceOid },
      include: {
        sessionProvider: {
          include: { session: true }
        }
      }
    });
    if (!instance) {
      console.warn(`No session provider instance found for topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let lastMessageAt = new Store<Date | null>(null);

    let instanceExtensionIv = setInterval(async () => {
      await db.sessionProviderInstance.updateMany({
        where: { oid: instance.oid },
        data: {
          lastUsedAt: lastMessageAt.value ?? undefined,
          lastRenewedAt: new Date(),
          expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
        }
      });

      lastMessageAt.set(null);
    }, 1000 * 60);

    ctx.onMessage(async (data: WireInput) => {
      try {
        console.log('Wire message received', data);
      } catch (err) {}
    });

    ctx.onClose(async () => {
      clearInterval(instanceExtensionIv);
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
