import type { SessionMessage, SessionMessageStatus } from '@metorial-subspace/db';

export type WireInput = {
  type: 'tool_call';

  sessionInstanceId: string;
  sessionMessageId: string;
  toolId: string;
  toolKey: string;
  toolCallableId: string;

  input: PrismaJson.SessionMessageInput;
};

export type WireResult = {
  status: SessionMessageStatus;
  completedAt: Date | null;
  message: SessionMessage | null;
  output: PrismaJson.SessionMessageOutput | null;
};

export type BroadcastMessage = {
  type: 'message_processed';
  sessionId: string;
  result: WireResult;
  channel: 'targeted_response' | 'broadcast_response_or_notification';
};
