import type { SessionMessage } from '@metorial-subspace/db';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export let messageOutputToMcp = async (
  output: PrismaJson.SessionMessageOutput,
  message: SessionMessage | undefined | null
): Promise<JSONRPCMessage | null> => {
  if (!output) return null;

  if (output.type === 'mcp') {
    return {
      jsonrpc: '2.0',
      id: message?.mcpMessageId,
      ...(output.data as any)
    };
  }

  if (!message?.mcpMessageId) return null;

  if (output.type === 'tool.result') {
    return {
      jsonrpc: '2.0',
      id: message.mcpMessageId,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(output.data)
          }
        ],
        structuredContent: output.data
      }
    };
  }

  return {
    jsonrpc: '2.0',
    id: message.mcpMessageId,
    error: {
      code: -32000,
      message: output.data.message,
      data: {
        ...output.data,
        object: undefined,
        status: undefined,
        __typename: 'MetorialError'
      }
    }
  };
};

export let messageInputToMcp = async (
  input: PrismaJson.SessionMessageInput,
  message: SessionMessage | undefined | null
): Promise<JSONRPCMessage | null> => {
  if (!input) return null;

  if (input.type === 'mcp') {
    return {
      jsonrpc: '2.0',
      id: message?.mcpMessageId ?? message?.id,
      ...(input.data as any)
    };
  }

  if (!message) return null;

  if (input.type === 'tool.call') {
    return {
      jsonrpc: '2.0',
      id: message.mcpMessageId ?? message.id,
      method: message.methodOrToolKey ?? 'unknown_method',
      params: input.data
    };
  }

  return null;
};

export let messageOutputToToolCall = async (
  output: PrismaJson.SessionMessageOutput,
  _message: SessionMessage | undefined | null
) => {
  if (!output) return null;

  if (output.type === 'mcp') {
    if ('params' in output.data && output.data.params)
      return output.data.params?.arguments ?? output.data.params;
    if ('result' in output.data && output.data.result)
      return output.data.result?.structuredContent ?? output.data.result;
    if ('error' in output.data && output.data.error) return output.data.error;
    return {};
  }

  if (output.type === 'tool.result') {
    return output.data;
  }

  return output.data;
};

export let messageInputToToolCall = async (
  input: PrismaJson.SessionMessageInput,
  _message: SessionMessage | undefined | null
) => {
  if (!input) return null;

  if (input.type === 'mcp') {
    if ('params' in input.data && input.data.params)
      return input.data.params?.arguments ?? input.data.params;
    if ('result' in input.data && input.data.result)
      return input.data.result?.structuredContent ?? input.data.result;
    if ('error' in input.data && input.data.error) return input.data.error;
    return {};
  }

  if (input.type === 'tool.call') {
    return input.data;
  }

  return {};
};
