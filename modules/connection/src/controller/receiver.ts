import { internalServerError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type {
  BroadcastMessage,
  ConduitInput,
  ConduitResult
} from '@metorial-subspace/connection-utils';
import { db, messageOutputToMcp } from '@metorial-subspace/db';
import { conduit } from '../lib/conduit';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { createMessage } from '../shared/createMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
import { ConnectionState } from './state';
import { getConnectionBackendConnection } from './state/backend';

let Sentry = getSentry();

export let startReceiver = () => {
  let receiver = conduit.createConduitReceiver(async ctx => {
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

    let providerParticipantProm = upsertParticipant({
      session: state.session,
      from: {
        type: 'provider',
        provider: state.provider
      }
    });

    let backend = await getConnectionBackendConnection(state);

    backend.onMessage(async data => {
      let mcpMessage = await messageOutputToMcp(data.output, null);
      if (!mcpMessage) return;

      let id = 'id' in mcpMessage ? mcpMessage.id : undefined;
      if (id) {
        // TODO: @herber handle mcp message requests from the server
        return;
      }

      let message = await createMessage({
        status: id ? 'waiting_for_response' : 'succeeded',
        type: 'mcp_message',
        session: state.session,
        connection: state.connection,
        source: 'provider',
        provider: state.sessionProvider,
        senderParticipant: await providerParticipantProm,
        transport: 'mcp',
        input: { type: 'mcp', data: mcpMessage },
        isProductive: true
      });

      await broadcastNats.publish(
        topics.sessionConnection.encode({
          session: state.session,
          connection: state.connection
        }),
        serialize.encode({
          type: 'message_processed',
          sessionId: state.session.id,
          result: {
            message,
            output: data.output,
            status: 'succeeded',
            completedAt: new Date()
          } satisfies ConduitResult,
          channel: 'broadcast_response_or_notification'
        } satisfies BroadcastMessage)
      );
    });

    let processMessage = async (data: ConduitInput) => {
      let message = await db.sessionMessage.findFirstOrThrow({
        where: { id: data.sessionMessageId }
      });

      try {
        let result = await backend.send({
          tool: { callableId: data.toolCallableId },
          sender: state.participant,
          input: data.input,
          message
        });

        if (!result.output) {
          return {
            isSystemError: false,
            status: 'succeeded' as const,
            output: null,
            completedAt: new Date(),
            slateToolCall: result.slateToolCall
          };
        }

        let status =
          result.output.type === 'success' ? ('succeeded' as const) : ('failed' as const);
        let output = result.output.type === 'error' ? result.output.error : result.output.data;

        return {
          isSystemError: false,
          status,
          output,
          completedAt: new Date(),
          slateToolCall: result.slateToolCall
        };
      } catch (err) {
        Sentry.captureException(err);

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

    ctx.onMessage(async (data: ConduitInput) => {
      ctx.extendTtl(state.messageTTLExtensionMs);

      let res = await processMessage(data);

      let output =
        res.status === 'failed'
          ? { type: 'error' as const, data: res.output as any }
          : { type: 'tool.result' as const, data: res.output };

      let message = await completeMessage(
        { messageId: data.sessionMessageId },
        {
          output,
          status: res.status,
          providerRun: state.providerRun,
          completedAt: res.completedAt,
          slateToolCall: res.slateToolCall,
          responderParticipant: await providerParticipantProm,
          failureReason: res.isSystemError ? 'system_error' : undefined
        }
      );

      let result = {
        message,
        output,
        status: res.status,
        completedAt: res.completedAt
      } satisfies ConduitResult;

      if (result.output) {
        await broadcastNats.publish(
          topics.sessionConnection.encode({
            session: state.session,
            connection: state.connection
          }),
          serialize.encode({
            type: 'message_processed',
            sessionId: state.session.id,
            channel: 'targeted_response',
            result
          } satisfies BroadcastMessage)
        );
      }

      return result;
    });

    ctx.onClose(async () => {
      console.log(`Closing provider instance receiver for instance id: ${state.instance.id}`);
      try {
        await state.dispose();
      } catch (err) {
        console.error('Error disposing connection state:', err);
        Sentry.captureException(err);
      }
      try {
        await backend.close();
      } catch (err) {
        console.error('Error closing connection backend:', err);
        Sentry.captureException(err);
      }
    });
  });

  receiver.start().catch(err => {
    console.error('Error starting Connection Controller receiver:', err);
  });
};
