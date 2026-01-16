import { SessionMessageStatus } from '@metorial-subspace/db';

export type WireInput = {
  type: 'tool_call';

  sessionInstanceId: string;
  sessionMessageId: string;
  toolId: string;
  toolKey: string;
  toolCallableId: string;
  channelIds: string[];

  input: any;
};

export type WireOutput = {
  status: SessionMessageStatus;
  output: any;
  completedAt: string;
};
