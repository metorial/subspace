import { sessionMessageBucketRecord } from '@metorial-subspace/connection-utils';
import {
  db,
  getId,
  SessionConnectionTransport,
  SessionMessageFailureReason,
  SessionMessageSource,
  SessionMessageStatus,
  SessionMessageType,
  type ProviderTool,
  type Session,
  type SessionConnection,
  type SessionError,
  type SessionParticipant,
  type SessionProvider
} from '@metorial-subspace/db';
import { messageCreatedQueue } from '../queues/message/messageCreated';
import { createError, messageFailureReasonToErrorType } from './createError';

export interface CreateMessageProps {
  status: SessionMessageStatus;
  type: SessionMessageType;
  source: SessionMessageSource;
  senderParticipant: SessionParticipant;
  transport: SessionConnectionTransport;
  failureReason?: SessionMessageFailureReason;

  input: PrismaJson.SessionMessageInput;
  output?: PrismaJson.SessionMessageOutput;
  responderParticipant?: SessionParticipant;

  provider?: SessionProvider;

  tool?: ProviderTool;
  methodOrToolKey?: string;

  isProductive: boolean;

  clientMcpId?: PrismaJson.SessionMessageClientMcpId;

  completedAt?: Date;
}

export interface CreateMessagePropsFull extends CreateMessageProps {
  session: Session;
  connection: SessionConnection | null;
}

export let createMessage = async (data: CreateMessagePropsFull) => {
  if (data.output && !data.responderParticipant) {
    throw new Error('responderParticipant is required when output is provided');
  }

  if (data.output?.type == 'error') {
    data.status = 'failed';
  }

  if (data.status && data.status != 'waiting_for_response') {
    data.completedAt = data.completedAt ?? new Date();
  }

  if (data.status == 'failed' && (!data.failureReason || data.failureReason == 'none')) {
    data.failureReason = 'provider_error';
  }

  let error: SessionError | undefined;
  if (data.status == 'failed') {
    error = await createError({
      type: messageFailureReasonToErrorType(data.failureReason ?? 'provider_error'),
      session: data.session,
      connection: data.connection,
      output: data.output!
    });
  }

  let message = await db.sessionMessage.create({
    data: {
      ...getId('sessionMessage'),
      status: 'waiting_for_response',
      type: 'tool_call',
      source: data.source,
      transport: data.transport,

      isProductive: data.isProductive,
      failureReason: data.failureReason ?? 'none',
      completedAt: data.completedAt,

      sessionOid: data.session.oid,
      connectionOid: data.connection?.oid,
      sessionProviderOid: data.provider?.oid,
      tenantOid: data.session.tenantOid,
      solutionOid: data.session.solutionOid,
      senderParticipantOid: data.senderParticipant.oid,
      responderParticipantOid: data.responderParticipant?.oid,

      bucketOid: sessionMessageBucketRecord.oid,
      errorOid: error?.oid,

      input: data.input,
      output: data.output,

      methodOrToolKey: data.tool?.key ?? data.methodOrToolKey ?? null,
      clientMcpId: data.clientMcpId ?? null,

      toolCall: data.tool
        ? {
            create: {
              ...getId('toolCall'),
              toolOid: data.tool.oid,
              toolKey: data.tool.key,
              sessionOid: data.session.oid,
              tenantOid: data.session.tenantOid,
              solutionOid: data.session.solutionOid
            }
          }
        : undefined
    }
  });

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'message_created',
      sessionOid: message.sessionOid,
      connectionOid: message.connectionOid,
      providerRunOid: message.providerRunOid,
      messageOid: message.oid,
      tenantOid: message.tenantOid,
      solutionOid: message.solutionOid
    }
  });

  if (message.status != 'waiting_for_response') {
    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'message_processed',
        sessionOid: message.sessionOid,
        connectionOid: message.connectionOid,
        providerRunOid: message.providerRunOid,
        messageOid: message.oid,
        tenantOid: message.tenantOid,
        solutionOid: message.solutionOid
      }
    });
  }

  await messageCreatedQueue.add({ messageId: message.id });

  return message;
};
