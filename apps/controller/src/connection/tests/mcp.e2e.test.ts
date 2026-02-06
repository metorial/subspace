import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startReceiver } from '@metorial-subspace/module-connection';
import { createHono } from '@lowerdeck/hono';
import { mcpRouter } from '../api/mcp';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { createFullFeaturedServer } from '../../../../../test-servers/src/servers/full-featured';
import { setupTransports } from '../../../../../test-servers/src/shared/transport';

const createStepLogger = (label: string) => {
  const startedAt = Date.now();
  return (message: string) => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[${label} +${elapsed}s] ${message}`);
  };
};

const toRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  if (input instanceof Request) {
    return new Request(input, init);
  }

  return new Request(input.toString(), init);
};

const transportCases = [
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

const startMcpTestServer = async () => {
  const app = express();
  const mcpServer = createFullFeaturedServer();

  await setupTransports(app, mcpServer, '/full');

  const startListening = async (port: number) =>
    await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const server = app.listen(port, () => resolve(server));
      server.once('error', reject);
    });

  const preferredPort = Number(process.env.TEST_MCP_SERVER_PORT ?? 52198);
  const listener = await (async () => {
    try {
      return await startListening(preferredPort);
    } catch (err) {
      let code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE') throw err;
      return await startListening(0);
    }
  })();

  const port = (listener.address() as AddressInfo).port;

  return { listener, port };
};

describe('mcp.e2e', () => {
  let receiver: Awaited<ReturnType<typeof startReceiver>> | null = null;
  let listener: Server | null = null;
  let remoteServerBaseUrl: string | null = null;
  let api = createHono().route(
    `/:solutionId/:tenantId/sessions/:sessionId/mcp`,
    mcpRouter
  );

  beforeAll(async () => {
    const log = createStepLogger('mcp.e2e/beforeAll');
    log('starting local MCP test server');
    const server = await startMcpTestServer();
    listener = server.listener;

    const host = process.env.TEST_MCP_SERVER_HOST ?? 'host.docker.internal';
    remoteServerBaseUrl = `http://${host}:${server.port}`;
    log(`MCP test server ready at ${remoteServerBaseUrl}`);
  });

  afterEach(
    async () => {
      if (receiver) {
        await receiver.stop();
        receiver = null;
      }
    },
    60_000
  );

  afterAll(
    async () => {
      if (listener) {
        const activeListener = listener as Server & {
          closeAllConnections?: () => void;
          closeIdleConnections?: () => void;
        };

        await new Promise<void>(resolve => {
          activeListener.close(() => resolve());
          activeListener.closeIdleConnections?.();
          activeListener.closeAllConnections?.();
        });
      }
    },
    60_000
  );

  beforeEach(async () => {
    await cleanDatabase();
    receiver = startReceiver();
  });

  it.each(transportCases)(
    'initializes and calls a tool via a real MCP connection over $name',
    { timeout: 120_000 },
    async transportCase => {
      const log = createStepLogger(`mcp.e2e/test/${transportCase.name}`);
      if (!remoteServerBaseUrl) throw new Error('Remote MCP URL not initialized');

      const upstreamUrl = `${remoteServerBaseUrl}${transportCase.upstreamPath}`;
      log(`using remote URL ${upstreamUrl}`);

      const f = fixtures(testDb);
      log('creating tenant/solution/environment fixtures');
      const tenant = await f.tenant.default({
        identifier: 'mcp-e2e-tenant',
        name: 'MCP E2E Tenant',
        urlKey: 'mcp-e2e-tenant'
      });
      const solution = await f.solution.default({
        identifier: 'mcp-e2e-solution',
        name: 'MCP E2E Solution'
      });
      const environment = await f.environment.default({
        tenant,
        overrides: {
          identifier: 'mcp-e2e-dev',
          name: 'MCP E2E Dev'
        }
      });
      log(
        `fixtures ready (tenant=${tenant.id}, solution=${solution.id}, environment=${environment.id})`
      );

      log('creating or reusing remote MCP provider setup');
      const providerSetup = await f.remoteMcpProvider.complete({
        remoteUrl: upstreamUrl,
        protocol: transportCase.providerProtocol,
        tenant,
        solution,
        environment
      });
      log(
        `provider setup ready (provider=${providerSetup.provider.id}, deployment=${providerSetup.providerDeployment.id})`
      );

      log('creating session with deployment');
      const session = await f.session.withDeployment({
        tenant: providerSetup.tenant,
        solution: providerSetup.solution,
        environment: providerSetup.environment,
        deployment: providerSetup.providerDeployment,
        name: 'MCP Session'
      });
      log(`session created (session=${session.id})`);

      const basePath = `/${providerSetup.solution.id}/${providerSetup.tenant.id}/sessions/${session.id}/mcp`;
      const baseUrl = `http://subspace-controller.test${basePath}`;
      log(`calling MCP proxy endpoint ${basePath}`);

      const localFetch: typeof fetch = async (input, init) => {
        return await api.fetch(toRequest(input, init));
      };

      const transport =
        transportCase.clientTransport === 'streamable_http'
          ? new StreamableHTTPClientTransport(new URL(baseUrl), {
              fetch: localFetch
            })
          : new SSEClientTransport(new URL(baseUrl), {
              fetch: localFetch,
              eventSourceInit: {
                fetch: localFetch
              }
            });
      const client = new Client({
        name: 'subspace-e2e',
        version: '1.0.0'
      });

      try {
        log(`connecting MCP SDK client (initialize, transport=${transportCase.clientTransport})`);
        await client.connect(transport);

        if (transport instanceof StreamableHTTPClientTransport) {
          expect(transport.sessionId).toBeTruthy();
          log(`initialize succeeded (sessionId=${transport.sessionId})`);
        } else {
          log('initialize succeeded (sse)');
        }

        const serverInfo = client.getServerVersion();
        expect(serverInfo?.name).toBeTruthy();
        log(`server info: ${serverInfo?.name}`);

        log('calling tools/list via MCP SDK client');
        const toolsRes = await client.listTools();
        const toolNames = toolsRes.tools.map(tool => tool.name);
        log(`tools/list returned ${toolNames.length} tools`);
        const addTool =
          toolNames.find(name => name === 'add') ??
          toolNames.find(name => /^add([._-]|$)/.test(name)) ??
          toolNames.find(name => /(^|[._-])add([._-]|$)/.test(name));
        expect(addTool).toBeTruthy();
        log(`selected add tool: ${addTool}`);

        log('calling tools/call via MCP SDK client for add(1,2)');
        const callResult = await client.callTool({
          name: addTool!,
          arguments: {
            a: 1,
            b: 2
          }
        });

        const content = (callResult as { content?: Array<{ type?: string; text?: string }> })
          .content;
        const contentText =
          content?.find(part => part.type === 'text')?.text ?? JSON.stringify(callResult);
        expect(contentText).toContain('Result: 3');
        log(`tools/call completed with payload: ${contentText}`);
      } finally {
        if (transport instanceof StreamableHTTPClientTransport) {
          await transport.terminateSession().catch(() => undefined);
        }
        await client.close();
      }
    }
  );
});
