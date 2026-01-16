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
      id: message?.clientMcpId,
      ...(input.data as any)
    };
  }

  if (!message?.clientMcpId) return null;

  if (input.type == 'tool.call') {
    return {
      jsonrpc: '2.0',
      id: message.clientMcpId,
      method: message.methodOrToolKey ?? 'unknown_method',
      params: input.data.params
    };
  }

  return null;
};
