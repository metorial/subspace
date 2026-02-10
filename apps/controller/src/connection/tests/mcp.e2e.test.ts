import { describe, expect, it } from 'vitest';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHono } from '@lowerdeck/hono';
import { mcpRouter } from '../api/mcp';
import { testDb } from '../../test/setup';
import { createMcpE2eContext } from '../../test/fixtures';
import { createHonoFetchAdapter } from '../../test/helpers/honoFetchAdapter';
import { createMcpTestClient } from '../../test/helpers/mcpClientFactory';
import { setupMcpE2ELifecycle } from '../../test/helpers/mcpE2ELifecycle';

let transportCases = [
  {
    name: 'streamable_http',
    providerProtocol: 'streamable_http',
    upstreamPath: '/full/mcp',
    clientTransport: 'streamable_http'
  },
  {
    name: 'sse',
    providerProtocol: 'sse',
    upstreamPath: '/full/sse',
    clientTransport: 'sse'
  }
] as const;

describe('mcp.e2e', () => {
  let lifecycle = setupMcpE2ELifecycle();
  let api = createHono().route('/:solutionId/:tenantId/sessions/:sessionId/mcp', mcpRouter);
  let localFetch = createHonoFetchAdapter(api);

  it.each(transportCases)(
    'initializes and calls a tool via a real MCP connection over $name',
    { timeout: 120_000 },
    async transportCase => {
      let ctx = await createMcpE2eContext(testDb, {
        remoteServerBaseUrl: lifecycle.getRemoteServerBaseUrl(),
        transportCase
      });

      let mcp = createMcpTestClient({
        baseUrl: ctx.proxyUrl,
        transportType: transportCase.clientTransport,
        fetch: localFetch
      });

      try {
        await mcp.connect();

        if (mcp.transport instanceof StreamableHTTPClientTransport) {
          expect(mcp.transport.sessionId).toBeTruthy();
        }
        expect(mcp.client.getServerVersion()?.name).toBeTruthy();

        let tools = await mcp.client.listTools();

        let toolNames = tools.tools.map(t => t.name);
        let addTool = toolNames.find(name => /(^|[_.-])add([_.-]|$)/.test(name));
        expect(
          addTool,
          `Expected an add-like tool for ${transportCase.name}. Discovered tools: ${
            toolNames.length ? toolNames.join(', ') : '(none)'
          }`
        ).toBeTruthy();
        let result = await mcp.client.callTool({ name: addTool!, arguments: { a: 1, b: 2 } });
        let text = (result as { content?: Array<{ type?: string; text?: string }> }).content?.find(
          p => p.type === 'text'
        )?.text;

        expect(text).toContain('Result: 3');
      } finally {
        await mcp.cleanup();
      }
    }
  );
});
