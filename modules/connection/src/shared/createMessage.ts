import {
  db,
  getId,
  ID,
  SessionMessageSource,
  SessionMessageStatus,
  SessionMessageType,
  type ProviderTool,
  type Session,
  type SessionConnection,
  type SessionProvider
} from '@metorial-subspace/db';
import { postprocessMessageQueue } from '../queues/message/postprocess';

export interface CreateMessageProps {
  status: SessionMessageStatus;
  type: SessionMessageType;
  source: SessionMessageSource;

  input: PrismaJson.SessionMessageInput;
  output?: PrismaJson.SessionMessageOutput;

  provider?: SessionProvider;

  tool?: ProviderTool;
  methodOrToolKey?: string;

  isProductive: boolean;

  clientMcpId?: PrismaJson.SessionMessageClientMcpId;
  isViaMcp: boolean;
}

export interface CreateMessagePropsFull extends CreateMessageProps {
  session: Session;
  connection: SessionConnection | null;
}

export let createMessage = async (d: CreateMessagePropsFull) => {
  let message = await db.sessionMessage.create({
    data: {
      ...getId('sessionMessage'),
      toolCallId: await ID.generateId('toolCall'),
      sessionOid: d.session.oid,
      status: 'waiting_for_response',
      type: 'tool_call',
      source: d.source,
      isProductive: d.isProductive,
      connectionOid: d.connection?.oid,
      sessionProviderOid: d.provider?.oid,

      input: d.input,
      output: d.output,

      methodOrToolKey: d.methodOrToolKey ?? d.tool?.key ?? null,
      toolOid: d.tool?.oid,
      clientMcpId: d.clientMcpId ?? null,
      isViaMcp: d.isViaMcp
    }
  });
  await postprocessMessageQueue.add({ messageId: message.id });

  (async () => {
    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'message_processed',
        sessionOid: d.session.oid,
        connectionOid: d.connection?.oid,
        providerRunOid: message.providerRunOid,
        messageOid: message.oid
      }
    });

    if (message.connectionOid) {
      await db.sessionConnection.updateMany({
        where: { oid: message.connectionOid },
        data: {
          lastActiveAt: new Date(),
          lastMessageAt: new Date(),
          totalProductiveClientMessageCount:
            d.isProductive && d.source == 'client' ? { increment: 1 } : undefined
        }
      });
    }

    if (message.sessionProviderOid) {
      await db.sessionProvider.updateMany({
        where: { oid: message.sessionProviderOid },
        data: {
          lastMessageAt: new Date(),
          totalProductiveClientMessageCount:
            d.isProductive && d.source == 'client' ? { increment: 1 } : undefined
        }
      });
    }

    await db.session.updateMany({
      where: { oid: message.sessionOid },
      data: {
        lastMessageAt: new Date(),
        totalProductiveClientMessageCount:
          d.isProductive && d.source == 'client' ? { increment: 1 } : undefined
      }
    });
  })().catch(() => {});

  return message;
};
