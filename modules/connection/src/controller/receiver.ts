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
import { completeMessage } from '../shared/completeMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
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
      include: { participant: true }
    });

    let instance = await db.sessionProviderInstance.findFirst({
      where: { oid: topic.instanceOid },
      include: {
        sessionProvider: {
          include: {
            session: true,
            tenant: true,
            config: true,
            authConfig: true,
            provider: true
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

    let participant = connection.participant;
    if (!participant) {
      console.warn(`No participant found for connection id: ${connection.id}`);
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
        connectionOid: connection.oid,
        sessionProviderOid: instance.sessionProvider.oid,
        tenantOid: session.tenantOid,
        solutionOid: session.solutionOid
      }
    });

    db.sessionEvent
      .createMany({
        data: {
          ...getId('sessionEvent'),
          type: 'provider_run_started',
          sessionOid: session.oid,
          connectionOid: connection.oid,
          providerRunOid: providerRun.oid,
          tenantOid: session.tenantOid,
          solutionOid: session.solutionOid
        }
      })
      .catch(() => {});

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

      await db.providerRun.updateMany({
        where: { oid: providerRun.oid },
        data: { lastPingAt: new Date() }
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
          client: participant
        });

        let status =
          result.output.type == 'success' ? ('succeeded' as const) : ('failed' as const);
        let output = result.output.type == 'error' ? result.output.error : result.output.data;

        return {
          isSystemError: false,
          status,
          output,
          completedAt: new Date(),
          slateToolCall: result.slateToolCall
        };
      } catch (err) {
        console.error('Error processing tool invocation:', err);

        let error = internalServerError({
          message: 'Failed to process tool call'
        }).toResponse();

        return {
          isSystemError: true,
          output: error,
          status: 'failed' as const,
          completedAt: new Date(),
          slateToolCall: undefined
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

      let participant = await upsertParticipant({
        session,
        from: {
          type: 'provider',
          provider: instance.sessionProvider.provider
        }
      });

      let message = await completeMessage(
        { messageId: data.sessionMessageId },
        {
          output,
          status: res.status,
          providerRun: providerRun,
          completedAt: res.completedAt,
          slateToolCall: res.slateToolCall,
          responderParticipant: participant,
          failureReason: res.isSystemError ? 'system_error' : undefined
        }
      );

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
      console.log(`Closing provider instance receiver for instance id: ${instance.id}`);

      clearInterval(instanceExtensionIv);

      await db.sessionEvent.createMany({
        data: {
          ...getId('sessionEvent'),
          type: 'provider_run_stopped',
          sessionOid: session.oid,
          connectionOid: connection.oid,
          providerRunOid: providerRun.oid,
          tenantOid: session.tenantOid,
          solutionOid: session.solutionOid
        }
      });

      await db.providerRun.updateMany({
        where: { oid: providerRun.oid },
        data: {
          status: 'stopped',
          completedAt: new Date()
        }
      });
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
