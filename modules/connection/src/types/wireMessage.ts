export type WireInput = {
  type: 'tool_call';

  sessionInstanceId: string;
  sessionMessageId: string;
  toolId: string;
  toolKey: string;
  toolCallableId: string;

  input: any;
};

export type WireOutput = {};
