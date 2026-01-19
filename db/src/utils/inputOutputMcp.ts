import type { SessionMessage } from '@metorial-subspace/db';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export let messageOutputToMcp = async (
  output: PrismaJson.SessionMessageOutput,
  message: SessionMessage | undefined | null
): Promise<JSONRPCMessage | null> => {
  if (!output) return null;

  if (output.type == 'mcp') {
    return {
      jsonrpc: '2.0',
      id: message?.clientMcpId,
      ...(output.data as any)
    };
  }

  if (!message?.clientMcpId) return null;

  if (output.type == 'tool.result') {
    return {
      jsonrpc: '2.0',
      id: message.clientMcpId,
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
    id: message.clientMcpId,
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

  if (input.type == 'mcp') {
    return {
      jsonrpc: '2.0',
      id: message?.clientMcpId ?? message?.id,
      ...(input.data as any)
    };
  }

  if (!message) return null;

  if (input.type == 'tool.call') {
    return {
      jsonrpc: '2.0',
      id: message.clientMcpId ?? message.id,
      method: message.methodOrToolKey ?? 'unknown_method',
      params: input.data
    };
  }

  return null;
};

export let messageOutputToToolCall = async (
  output: PrismaJson.SessionMessageOutput,
  message: SessionMessage | undefined | null
) => {
  if (!output) return null;

  if (output.type == 'mcp') {
    if ('params' in output.data) return output.data.params?.arguments ?? output.data.params;
    if ('result' in output.data) return output.data.result;
    if ('error' in output.data) return output.data.error;
    return {};
  }

  if (output.type == 'tool.result') {
    return output.data;
  }

  return output.data;
};

export let messageInputToToolCall = async (
  input: PrismaJson.SessionMessageInput,
  message: SessionMessage | undefined | null
) => {
  if (!input) return null;

  if (input.type == 'mcp') {
    if ('params' in input.data) return input.data.params?.arguments ?? input.data.params;
    if ('result' in input.data) return input.data.result;
    if ('error' in input.data) return input.data.error;
    return {};
  }

  if (input.type == 'tool.call') {
    return input.data;
  }

  return {};
};
