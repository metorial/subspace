import { Cases } from '@lowerdeck/case';
import { internalServerError, isServiceError } from '@lowerdeck/error';
import { ID, SessionConnectionMcpConnectionTransport } from '@metorial-subspace/db';
import {
  CallToolRequest,
  CallToolRequestSchema,
  InitializeRequest,
  InitializeRequestSchema,
  InitializeResult,
  JSONRPCErrorResponse,
  JSONRPCMessage,
  JSONRPCResponse,
  ListToolsRequestSchema,
  ListToolsResult
} from '@modelcontextprotocol/sdk/types.js';
import { providerToolPresenter } from '../presenter';
import { McpControlMessageHandler } from './control';
import { markdownList } from './lib/markdownList';
import { mcpValidate } from './lib/mcpValidate';
import { wireResultToMcpMessage } from './lib/wireResultToMcpMessage';
import { McpManager } from './manager';

type ID = string | number;

export type HandleResponseOpts = { waitForResponse: boolean };

export class McpSender {
  constructor(
    private readonly mcpTransport: SessionConnectionMcpConnectionTransport,
    private readonly manager: McpManager,
    private readonly control: McpControlMessageHandler
  ) {}

  get session() {
    return this.manager.session;
  }

  async handleMessage(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    let method = 'method' in msg ? msg.method : undefined;
    let id = 'id' in msg ? msg.id : undefined;

    try {
      let res = await this.handleMessageInternal(msg, opts);
      if (!res || !res.mcp) return null;

      let message = 'message' in res ? res.message : null;
      let isBroadcastBySender = !!message;
      if (res.store && !message) {
        message = await this.manager.createMessage({
          status: 'error' in res.mcp ? 'failed' : 'succeeded',
          type: 'mcp_control',
          source: 'client',

          input: { type: 'mcp', data: msg },
          output: { type: 'mcp', data: res.mcp },

          methodOrToolKey: method,
          clientMcpId: id ?? null,
          isViaMcp: true
        });
      }

      if (!isBroadcastBySender) {
        await this.control.sendControlMessage({
          type: 'mcp_control_message',
          wire: {
            message,
            status: 'error' in res.mcp ? 'failed' : 'succeeded',
            output: { type: 'mcp', data: res.mcp },
            completedAt: message?.completedAt ?? null
          },
          channel: 'targeted_response'
        });
      }

      return {
        message,
        mcp: res.mcp
      };
    } catch (e) {
      console.error('Error handling MCP message:', e);

      let error = isServiceError(e)
        ? e
        : internalServerError({ message: 'Internal server error processing MCP message' });

      let message = await this.manager.createMessage({
        status: 'failed',
        type: 'unknown',
        source: 'client',

        input: { type: 'mcp', data: msg },
        output: {
          type: 'error',
          data: error.toResponse()
        },

        methodOrToolKey: method,
        clientMcpId: id,
        isViaMcp: true
      });

      await this.control.sendControlMessage({
        type: 'mcp_control_message',
        wire: {
          message,
          status: message.status,
          output: message.output,
          completedAt: message.completedAt
        },
        channel: 'targeted_response'
      });

      return {
        message,
        mcp: await wireResultToMcpMessage({
          message,
          output: message.output,
          status: message.status,
          completedAt: message.completedAt
        })
      };
    }
  }

  private async handleMessageInternal(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    // TODO: for mcp capable backends we should have something other
    // than call tool which directly forwards the mcp message

    let method = 'method' in msg ? msg.method : null;
    let id = 'id' in msg ? msg.id : null;

    if (method === 'ping' && id) return this.handlePingRequest(id);
    if (typeof id == 'string' && id.startsWith('mt/ping/')) return this.handlePingResponse(id);

    if (!method) {
      // TODO: handle responses for mcp-compatible backends
      return;
    }

    if (id === undefined || id === null || method.startsWith('notifications/')) {
      // TODO: handle notification for mcp-compatible backends
      return;
    }

    switch (method) {
      case 'initialize':
        let initMessage = mcpValidate(id, InitializeRequestSchema, msg);
        if (!initMessage.success) return { mcp: initMessage.error, store: true };
        return this.handleInitMessage(id, initMessage.data);

      case 'tools/list':
        let toolList = mcpValidate(id, ListToolsRequestSchema, msg);
        if (!toolList.success) return { mcp: toolList.error, store: true };
        return this.handleToolListMessage(id);

      case 'tools/call':
        let toolCall = mcpValidate(id, CallToolRequestSchema, msg);
        if (!toolCall.success) return { mcp: toolCall.error, store: true };
        return this.handleToolCallMessage(id, toolCall.data, opts);
    }

    return {
      store: false,
      mcp: {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      } satisfies JSONRPCErrorResponse
    };
  }

  private async handlePingRequest(id: ID) {
    return {
      store: false,
      mcp: { jsonrpc: '2.0', id, result: {} } satisfies JSONRPCResponse
    };
  }

  private async handlePingResponse(id: ID) {
    return { store: false, mcp: null };
  }

  private async handleToolCallMessage(
    id: ID,
    msg: CallToolRequest,
    opts: { waitForResponse: boolean }
  ) {
    let result = await this.manager.callTool({
      clientMcpId: id,
      toolId: msg.params.name,
      input: msg.params.arguments ?? {},
      waitForResponse: opts.waitForResponse,
      isViaMcp: true
    });

    if (!opts.waitForResponse) return { message: result.message };

    return {
      store: true,
      message: result.message,
      mcp: await wireResultToMcpMessage(result)
    };
  }

  private async handleToolListMessage(id: ID) {
    let tools = await this.manager.listTools();

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          tools: tools.map(t => {
            let presented = providerToolPresenter(t);

            return {
              name: presented.key,
              title: presented.name,

              inputSchema: presented.inputJsonSchema as any,
              outputSchema: presented.outputJsonSchema as any,

              description:
                [
                  presented.description,
                  markdownList('Constraints', presented.constraints),
                  markdownList('Instructions', presented.instructions)
                ]
                  .filter(Boolean)
                  .join('\n\n')
                  .trim() || undefined,

              annotations: {
                readOnlyHint: presented.tags?.readOnly,
                destructiveHint: presented.tags?.destructive
              }
            };
          })
        } satisfies ListToolsResult
      } satisfies JSONRPCResponse
    };
  }

  private async handleInitMessage(id: ID, msg: InitializeRequest) {
    let init = msg.params;
    let client = init.clientInfo;

    await this.manager.initialize({
      client: {
        ...client,
        name: client.name || 'Unknown',
        identifier: [client.name, client.version].filter(Boolean).join('@').trim() ?? 'unknown'
      },
      mcpCapabilities: init.capabilities,
      mcpProtocolVersion: init.protocolVersion,
      mcpTransport: this.mcpTransport
    });

    let providers = await this.manager.listProviders();

    let name =
      this.session.sharedProviderName ?? providers.map(p => p.provider.name).join(', ');
    let description = [
      this.session.sharedProviderDescription,
      ...providers.map(p => `# ${p.provider.name}\n${p.provider.description ?? ''}`.trim())
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: init.protocolVersion,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name:
              providers.length === 1
                ? Cases.toPascalCase(providers[0].provider.name)
                : 'UnifiedProvider',
            title: name,
            version: '1.0.0',
            description
          }
        } satisfies InitializeResult
      } satisfies JSONRPCResponse
    };
  }
}
