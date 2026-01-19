import { getOffloadedSessionMessage } from '@metorial-subspace/connection-utils';
import type {
  Provider,
  ProviderRun,
  ProviderSpecification,
  ProviderTool,
  Session,
  SessionConnection,
  SessionMessage,
  SessionParticipant,
  SessionProvider,
  ToolCall
} from '@metorial-subspace/db';
import { messageInputToMcp, messageOutputToMcp } from '@metorial-subspace/db';
import { type SessionErrorPresenterProps, sessionErrorPresenter } from './sessionError';
import { sessionParticipantPresenter } from './sessionParticipant';
import { toolCallPresenter } from './toolCall';

export type SessionMessagePresenterProps = SessionMessage & {
  session: Session;
  sessionProvider: SessionProvider | null;
  senderParticipant: SessionParticipant & { provider: Provider | null };
  responderParticipant: (SessionParticipant & { provider: Provider | null }) | null;
  connection: SessionConnection | null;
  providerRun: ProviderRun | null;
  toolCall:
    | (ToolCall & {
        tool: ProviderTool & {
          provider: Provider;
          specification: Omit<ProviderSpecification, 'value'>;
        };
      })
    | null;
  error: SessionErrorPresenterProps | null;
};

export let sessionMessagePresenter = async (message: SessionMessagePresenterProps) => {
  if (message.isOffloadedToStorage) {
    let offloaded = await getOffloadedSessionMessage(message);
    if (offloaded) {
      message.input = offloaded.input;
      message.output = offloaded.output;
    }
  }

  return {
    object: 'session.message',

    id: message.id,
    type: message.type,
    status: message.status,
    source: message.source,

    sessionId: message.session.id,
    sessionProviderId: message.sessionProvider?.id || null,
    connectionId: message.connection?.id || null,
    providerRunId: message.providerRun?.id || null,

    transport: {
      object: 'session.message.transport',

      type: message.transport,

      mcp:
        message.transport === 'mcp'
          ? {
              object: 'session.message.transport#mcp',

              id: message.input?.data?.id ?? message.clientMcpId ?? message.id,
              protocolVersion: message.connection?.mcpProtocolVersion ?? 'unknown',

              transport: {
                none: 'unknown',
                sse: 'sse',
                streamable_http: 'streamable_http'
              }[message.connection?.mcpTransport ?? 'none']
            }
          : undefined,

      toolCall:
        message.transport !== 'tool_call'
          ? {
              object: 'session.message.transport#tool_call',
              id: message.toolCall?.id || null
            }
          : undefined
    },

    input: message.input ? await messageInputToMcp(message.input, message) : null,
    output: message.output ? await messageOutputToMcp(message.output, message) : null,

    toolCall: message.toolCall
      ? await toolCallPresenter({
          ...message.toolCall,
          message
        })
      : null,

    senderParticipant: sessionParticipantPresenter(message.senderParticipant),
    responderParticipant: message.responderParticipant
      ? sessionParticipantPresenter(message.responderParticipant)
      : null,

    error: message.error ? sessionErrorPresenter(message.error) : null,

    createdAt: message.createdAt
  };
};
