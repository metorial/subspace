import { internalServerError } from '@lowerdeck/error';
import { db, getId } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../const';
import { broadcastNats } from '../lib/nats';
import { Store } from '../lib/store';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { WireInput, WireOutput } from '../types/wireMessage';

export let startController = () => {
  let receiver = wire.createWireReceiver(async ctx => {
    ctx.extendTtl(1000 * 60);

    let topic = topics.instance.decode(ctx.topic);
    if (!topic) {
      console.warn(`Received message on invalid topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let instance = await db.sessionProviderInstance.findFirst({
      where: { oid: topic.instanceOid },
      include: {
        sessionProvider: {
          include: {
            session: { include: { client: true } },
            tenant: true,
            config: true,
            authConfig: true
          }
        },
        pairVersion: {
          include: {
            version: {
              include: {
                provider: true,
                slate: true,
                slateVersion: true,
                providerVariant: true
              }
            }
          }
        }
      }
    });
    if (!instance) {
      console.warn(`No session provider instance found for topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let pairVersion = instance.pairVersion;
    let version = pairVersion.version;
    if (!version.slate || !version.slateVersion) {
      console.warn(
        `Session provider instance ${instance.oid} is missing slate or slate version association`
      );
      ctx.close();
      return;
    }

    let session = instance.sessionProvider.session;
    let client = session.client;
    if (!client) {
      console.warn(
        `Session provider instance ${instance.oid} has a session with no associated client`
      );
      ctx.close();
      return;
    }

    let providerRun = await db.providerRun.create({
      data: {
        ...getId('providerRun'),
        providerOid: instance.sessionProvider.providerOid,
        providerVersionOid: version.oid,
        sessionOid: instance.sessionProvider.sessionOid,
        instanceOid: instance.oid
      }
    });

    let backend = await getBackend({ entity: version });
    let backendProviderRun = await backend.toolInvocation.createProviderRun({
      tenant: instance.sessionProvider.tenant,
      providerConfig: instance.sessionProvider.config,

      providerVersion: version,
      provider: version.provider,
      providerVariant: version.providerVariant,

      providerRun: providerRun
    });

    let messageTTLExtensionMs = 1000 * 60 * 2;
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

    let processMessage = async (data: WireInput) => {
      try {
        let result = await backend.toolInvocation.createToolInvocation({
          tenant: instance.sessionProvider.tenant,
          provider: version.provider,
          providerRun: providerRun,
          tool: { callableId: data.toolCallableId },
          slateSession: backendProviderRun.slateSession,
          runState: backendProviderRun.runState,
          providerAuthConfig: instance.sessionProvider.authConfig,
          input: data.input,
          client
        });

        let status =
          result.output.type == 'success' ? ('succeeded' as const) : ('failed' as const);
        let output = result.output.type == 'error' ? result.output.error : result.output.data;

        return {
          status,
          output,
          completedAt: new Date().toISOString(),
          slateToolCallOid: result.slateToolCall?.oid
        };
      } catch (err) {
        console.error('Error processing tool invocation:', err);

        let error = internalServerError({
          message: 'Error processing tool call'
        }).toResponse();

        return {
          output: error,
          status: 'failed' as const,
          completedAt: new Date().toISOString(),
          slateToolCallOid: undefined
        };
      }
    };

    ctx.onMessage(async (data: WireInput) => {
      ctx.extendTtl(messageTTLExtensionMs);

      let res = await processMessage(data);

      await db.sessionMessage.updateMany({
        where: { id: data.sessionMessageId },
        data: {
          status: res.status,
          output: res.output,
          completedAt: new Date(),
          providerRunOid: providerRun.oid,
          slateToolCallOid: res.slateToolCallOid
        }
      });

      let output = {
        status: res.status,
        output: res.output,
        completedAt: res.completedAt
      } satisfies WireOutput;

      await broadcastNats.publish(
        topics.session.encode({ session }),
        JSON.stringify({
          type: 'message_processed',
          sessionId: session.id,
          channelIds: ['all', data.channelIds],
          data,
          output
        })
      );

      return output;
    });

    ctx.onClose(async () => {
      clearInterval(instanceExtensionIv);
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
