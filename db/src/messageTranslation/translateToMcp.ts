import type { ProviderTool, SessionMessage, SessionProvider } from '@metorial-subspace/db';
import type {
  CallToolRequest,
  CallToolResult,
  GetPromptRequest,
  JSONRPCMessage,
  ListResourcesRequest,
  ListResourceTemplatesRequest,
  ReadResourceRequest
} from '@modelcontextprotocol/sdk/types.js';

export let translateMessageToMcp = async ({
  data,
  tool,
  message,
  recipient,
  sessionProvider
}: {
  tool: ProviderTool;
  sessionProvider: SessionProvider;
  recipient: 'client' | 'provider_backend';
  message: SessionMessage | undefined | null;
  data: PrismaJson.SessionMessageOutput | PrismaJson.SessionMessageInput;
}): Promise<JSONRPCMessage | null> => {
  if (!data) return null;

  if (data.type === 'mcp') {
    if ('params' in data.data && data.data.params?.name) {
      if (recipient == 'client') {
        data.data.params.name = `${sessionProvider.tag}_${tool.key}`;
      } else {
        data.data.params.name = tool.callableId;
      }
    }

    if ('result' in data.data && data.data.result?.name) {
      if (recipient == 'client') {
        data.data.result.name = `${sessionProvider.tag}_${tool.key}`;
      } else {
        data.data.result.name = tool.callableId;
      }
    }

    return {
      jsonrpc: '2.0',
      id: message?.clientMcpId,
      ...(data.data as any)
    };
  }

  if (!message) return null;

  if (data.type === 'tool.result') {
    return {
      jsonrpc: '2.0',
      id: message.clientMcpId ?? message.id,
      result: {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(data.data)
          }
        ],
        structuredContent: data.data
      }
    } satisfies JSONRPCMessage & { result: CallToolResult };
  }

  if (data.type === 'tool.call') {
    if (tool.value.mcpToolType.type == 'tool.callable') {
      return {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: message.clientMcpId ?? message.id,
        params: {
          name: recipient == 'client' ? `${sessionProvider.tag}_${tool.key}` : tool.callableId,
          arguments: data.data
        }
      } satisfies JSONRPCMessage & CallToolRequest;
    }

    if (tool.value.mcpToolType.type == 'mcp.resources_list') {
      return {
        jsonrpc: '2.0',
        method: 'resources/list',
        id: message.clientMcpId ?? message.id,
        params: {
          cursor: data.data.cursor,
          _meta: data.data._meta
        }
      } satisfies JSONRPCMessage & ListResourcesRequest;
    }

    if (tool.value.mcpToolType.type == 'mcp.resources_read') {
      return {
        jsonrpc: '2.0',
        method: 'resources/read',
        id: message.clientMcpId ?? message.id,
        params: {
          uri:
            recipient == 'provider_backend'
              ? data.data.uri.replace(`${sessionProvider.tag}_`, '')
              : data.data.uri,
          _meta: data.data._meta
        }
      } satisfies JSONRPCMessage & ReadResourceRequest;
    }

    if (tool.value.mcpToolType.type == 'mcp.resource_template') {
      return {
        jsonrpc: '2.0',
        id: message.clientMcpId ?? message.id,
        method: 'resources/templates/list'
      } satisfies JSONRPCMessage & ListResourceTemplatesRequest;
    }

    if (tool.value.mcpToolType.type == 'mcp.prompt') {
      return {
        jsonrpc: '2.0',
        method: 'prompts/get',
        id: message.clientMcpId ?? message.id,
        params: {
          name: recipient == 'client' ? `${sessionProvider.tag}_${tool.key}` : tool.callableId,
          arguments: data.data
        }
      } satisfies JSONRPCMessage & GetPromptRequest;
    }

    return {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: message.clientMcpId ?? message.id,
      params: {
        name: recipient == 'client' ? `${sessionProvider.tag}_${tool.key}` : tool.callableId,
        arguments: data.data
      }
    } satisfies JSONRPCMessage & CallToolRequest;
  }

  return {
    jsonrpc: '2.0',
    id: message.clientMcpId ?? message.id,
    error: {
      code: -32000,
      message: data.data.message,
      data: {
        ...data.data,
        object: undefined,
        status: undefined,
        __typename: 'MetorialError'
      }
    }
  };
};

export let messageOutputToMcpBasic = async (
  output: PrismaJson.SessionMessageOutput,
  message: SessionMessage | undefined | null
): Promise<JSONRPCMessage | null> => {
  if (!output) return null;

  if (output.type === 'mcp') {
    return {
      jsonrpc: '2.0',
      id: message?.clientMcpId,
      ...(output.data as any)
    };
  }

  if (!message?.clientMcpId) return null;

  if (output.type === 'tool.result') {
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
