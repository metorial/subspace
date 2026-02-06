import express from 'express';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { startReceiver } from '@metorial-subspace/module-connection';
import { createHono } from '@lowerdeck/hono';
import { mcpRouter } from '../api/mcp';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { createFullFeaturedServer } from '../../../../../test-servers/src/servers/full-featured';
import { setupTransports } from '../../../../../test-servers/src/shared/transport';

const parseFirstSseData = (payload: string) => {
  const lines = payload.split(/\r?\n/);
  const dataLines = lines.filter(line => line.startsWith('data:'));
  if (!dataLines.length) {
    throw new Error(`No SSE data line found. Payload:\n${payload}`);
  }

  const json = dataLines
    .map(line => line.replace(/^data:\s?/, ''))
    .join('\n')
    .trim();

  return JSON.parse(json);
};

const createStepLogger = (label: string) => {
  const startedAt = Date.now();
  return (message: string) => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[${label} +${elapsed}s] ${message}`);
  };
};

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
  let remoteUrl: string | null = null;
  let api = createHono().route(
    `/:solutionId/:tenantId/sessions/:sessionId/mcp`,
    mcpRouter
  );

  beforeAll(async () => {
    const log = createStepLogger('mcp.e2e/beforeAll');
    log('starting connection receiver');
    receiver = startReceiver();

    log('starting local MCP test server');
    const server = await startMcpTestServer();
    listener = server.listener;

    const host = process.env.TEST_MCP_SERVER_HOST ?? 'host.docker.internal';
    remoteUrl = `http://${host}:${server.port}/full/mcp`;
    log(`MCP test server ready at ${remoteUrl}`);
  });

  afterAll(async () => {
    if (receiver) {
      await receiver.stop();
    }

    if (listener) {
      let activeListener = listener;
      await new Promise<void>(resolve => activeListener.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it(
    'initializes and calls a tool via a real MCP connection',
    { timeout: 90_000 },
    async () => {
      const log = createStepLogger('mcp.e2e/test');
      if (!remoteUrl) throw new Error('Remote MCP URL not initialized');
      log(`using remote URL ${remoteUrl}`);

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
        remoteUrl,
        protocol: 'streamable_http',
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

      log('sending initialize request');
      const initRes = await api.fetch(
        new Request(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'subspace-e2e',
                version: '1.0.0'
              }
            }
          })
        })
      );

      expect(initRes.status).toBe(200);
      const sessionId = initRes.headers.get('mcp-session-id');
      expect(sessionId).toBeTruthy();
      log(`initialize succeeded (sessionId=${sessionId})`);

      const initPayload = parseFirstSseData(await initRes.text());
      expect(initPayload.result?.serverInfo?.name).toBeTruthy();
      log(`server info: ${initPayload.result?.serverInfo?.name}`);

      log('sending tools/list request');
      const toolsRes = await api.fetch(
        new Request(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'mcp-session-id': sessionId!
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
          })
        })
      );
      expect(toolsRes.status).toBe(200);

      const toolsPayload = parseFirstSseData(await toolsRes.text());
      const toolNames = toolsPayload.result?.tools?.map((tool: any) => tool.name) ?? [];
      log(`tools/list returned ${toolNames.length} tools`);
      const addTool =
        toolNames.find((name: string) => name === 'add') ??
        toolNames.find((name: string) => /^add([._-]|$)/.test(name)) ??
        toolNames.find((name: string) => /(^|[._-])add([._-]|$)/.test(name));
      expect(addTool).toBeTruthy();
      log(`selected add tool: ${addTool}`);

      log('sending tools/call request for add(1,2)');
      const callRes = await api.fetch(
        new Request(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'mcp-session-id': sessionId!
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: addTool,
              arguments: {
                a: 1,
                b: 2
              }
            }
          })
        })
      );
      expect(callRes.status).toBe(200);

      const callPayload = parseFirstSseData(await callRes.text());
      const contentText =
        callPayload.result?.content?.[0]?.text ?? JSON.stringify(callPayload.result ?? {});
      expect(contentText).toContain('Result: 3');
      log(`tools/call completed with payload: ${contentText}`);
    }
  );
});
