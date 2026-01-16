import { internalServerError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { db, getId } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../const';
import { broadcastNats } from '../lib/nats';
import { Store } from '../lib/store';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import type { BroadcastMessage, WireInput, WireResult } from '../types/wireMessage';

export let startController = () => {
  let receiver = wire.createWireReceiver(async ctx => {
    ctx.extendTtl(1000 * 60);

    let topic = topics.instance.decode(ctx.topic);
    if (!topic) {
      console.warn(`Received message on invalid topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let connection = await db.sessionConnection.findFirst({
      where: { oid: topic.connectionOid },
      include: { client: true }
    });

    let instance = await db.sessionProviderInstance.findFirst({
      where: { oid: topic.instanceOid },
      include: {
        sessionProvider: {
          include: {
            session: true,
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
    if (!connection) {
      console.warn(`No session client found for topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let client = connection.client;
    if (!client) {
      console.warn(`No client found for connection id: ${connection.id}`);
      ctx.close();
      return;
    }

    let pairVersion = instance.pairVersion;
    let version = pairVersion.version;
    if (!version.slate || !version.slateVersion) {
      console.warn(
        `Session provider instance ${instance.id} is missing slate or slate version association`
      );
      ctx.close();
      return;
    }

    let session = instance.sessionProvider.session;

    let providerRun = await db.providerRun.create({
      data: {
        ...getId('providerRun'),
        providerOid: instance.sessionProvider.providerOid,
        providerVersionOid: version.oid,
        sessionOid: instance.sessionProvider.sessionOid,
        instanceOid: instance.oid,
        connectionOid: connection.oid
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
          completedAt: new Date(),
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
          completedAt: new Date(),
          slateToolCallOid: undefined
        };
      }
    };

    ctx.onMessage(async (data: WireInput) => {
      ctx.extendTtl(messageTTLExtensionMs);

      let res = await processMessage(data);

      let output =
        res.status == 'failed'
          ? { type: 'error' as const, data: res.output as any }
          : { type: 'tool.result' as const, data: res.output };

      let message = await db.sessionMessage.update({
        where: { id: data.sessionMessageId },
        data: {
          status: res.status,
          output,
          completedAt: new Date(),
          providerRunOid: providerRun.oid,
          slateToolCallOid: res.slateToolCallOid
        }
      });
      db.sessionEvent
        .updateMany({
          where: { messageOid: message.oid },
          data: { providerRunOid: providerRun.oid }
        })
        .catch(() => {});

      let result = {
        message,
        output,
        status: res.status,
        completedAt: res.completedAt
      } satisfies WireResult;

      await broadcastNats.publish(
        topics.sessionConnection.encode({ session, connection }),
        serialize.encode({
          type: 'message_processed',
          sessionId: session.id,
          result,
          channel: 'targeted_response'
        } satisfies BroadcastMessage)
      );

      return result;
    });

    ctx.onClose(async () => {
      clearInterval(instanceExtensionIv);
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
