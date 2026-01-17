import type {
  Provider,
  Session,
  SessionConnection,
  SessionParticipant
} from '@metorial-subspace/db';
import { sessionParticipantPresenter } from './sessionParticipant';

export let sessionConnectionPresenter = (
  connection: SessionConnection & {
    session: Session;
    participant:
      | (SessionParticipant & {
          provider: Provider | null;
        })
      | null;
  }
) => ({
  object: 'session.connection',

  id: connection.id,
  status: connection.status,
  connectionState: connection.state,

  usage: {
    totalProductiveClientMessageCount: connection.totalProductiveClientMessageCount,
    totalProductiveServerMessageCount: connection.totalProductiveServerMessageCount
  },

  mcp:
    connection.mcpData.capabilities && connection.mcpData.protocolVersion
      ? {
          capabilities: connection.mcpData.capabilities,
          protocolVersion: connection.mcpData.protocolVersion,
          transport: connection.mcpTransport
        }
      : null,

  sessionId: connection.session.id,

  participant: connection.participant
    ? sessionParticipantPresenter(connection.participant)
    : null,

  createdAt: connection.createdAt,
  lastMessageAt: connection.lastMessageAt,
  lastActiveAt: connection.lastActiveAt
});
