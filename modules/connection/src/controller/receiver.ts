import { internalServerError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { getBackend } from '@metorial-subspace/provider';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { completeMessage } from '../shared/completeMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
import type { BroadcastMessage, WireInput, WireResult } from '../types/wireMessage';
import { ConnectionState } from './state';

export let startController = () => {
  let receiver = wire.createWireReceiver(async ctx => {
    ctx.extendTtl(1000 * 60);

    let topic = topics.instance.decode(ctx.topic);
    if (!topic) {
      console.warn(`Received message on invalid topic: ${ctx.topic}`);
      ctx.close();
      return;
    }

    let state = await ConnectionState.create(topic, () => {
      ctx.close();
    });
    if (!state) {
      ctx.close();
      return;
    }

    let backend = await getBackend({ entity: state.version });
    let backendProviderRun = await backend.toolInvocation.createProviderRun({
      tenant: state.instance.sessionProvider.tenant,
      providerConfig: state.instance.sessionProvider.config,

      providerVersion: state.version,
      provider: state.version.provider,
      providerVariant: state.version.providerVariant,

      providerRun: state.providerRun
    });

    let processMessage = async (data: WireInput) => {
      try {
        let result = await backend.toolInvocation.createToolInvocation({
          tenant: state.instance.sessionProvider.tenant,
          provider: state.version.provider,
          providerRun: state.providerRun,
          tool: { callableId: data.toolCallableId },
          slateSession: backendProviderRun.slateSession,
          runState: backendProviderRun.runState,
          providerAuthConfig: state.instance.sessionProvider.authConfig,
          input: data.input,
          client: state.participant
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
      ctx.extendTtl(state.messageTTLExtensionMs);

      let res = await processMessage(data);

      let output =
        res.status == 'failed'
          ? { type: 'error' as const, data: res.output as any }
          : { type: 'tool.result' as const, data: res.output };

      let participant = await upsertParticipant({
        session: state.session,
        from: {
          type: 'provider',
          provider: state.provider
        }
      });

      let message = await completeMessage(
        { messageId: data.sessionMessageId },
        {
          output,
          status: res.status,
          providerRun: state.providerRun,
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
        topics.sessionConnection.encode({
          session: state.session,
          connection: state.connection
        }),
        serialize.encode({
          type: 'message_processed',
          sessionId: state.session.id,
          result,
          channel: 'targeted_response'
        } satisfies BroadcastMessage)
      );

      return result;
    });

    ctx.onClose(async () => {
      console.log(`Closing provider instance receiver for instance id: ${state.instance.id}`);
      await state.dispose();
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
