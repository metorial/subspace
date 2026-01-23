import type { SessionMessage, SessionMessageStatus } from '@metorial-subspace/db';

export type ConduitInput = {
  type: 'tool_call';

  sessionInstanceId: string;
  sessionMessageId: string;
  toolId: string;
  toolKey: string;
  toolCallableId: string;

  input: PrismaJson.SessionMessageInput;
};

export type ConduitResult = {
  status: SessionMessageStatus;
  completedAt: Date | null;
  message: SessionMessage | null;
  output: PrismaJson.SessionMessageOutput | null;
};

export type BroadcastMessage = {
  type: 'message_processed';
  sessionId: string;
  result: ConduitResult;
  channel: 'targeted_response' | 'broadcast_response_or_notification';
};
