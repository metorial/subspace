import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { WireResult } from '../../types/wireMessage';

export let wireResultToMcpMessage = async (
  msg: WireResult
): Promise<JSONRPCMessage | null> => {
  if (!msg.output) return null;

  if (msg.output.type == 'mcp') {
    return {
      jsonrpc: '2.0',
      id: msg.message?.clientMcpId,
      ...(msg.output.data as any)
    };
  }

  if (!msg.message?.clientMcpId) return null;

  if (msg.output.type == 'tool.result') {
    return {
      jsonrpc: '2.0',
      id: msg.message.clientMcpId,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(msg.output.data)
          }
        ],
        structuredContent: msg.output.data
      }
    };
  }

  return {
    jsonrpc: '2.0',
    id: msg.message.clientMcpId,
    error: {
      code: -32000,
      message: msg.output.data.message,
      data: {
        ...msg.output.data,
        object: undefined,
        status: undefined,
        __typename: 'MetorialError'
      }
    }
  };
};
