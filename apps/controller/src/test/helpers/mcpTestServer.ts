import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createFullFeaturedServer } from '../../../../../test-servers/src/servers/full-featured';
import { setupTransports } from '../../../../../test-servers/src/shared/transport';

export type McpTestServerHandle = {
  listener: Server;
  port: number;
  baseUrl: string;
};

export let startMcpTestServer = async (): Promise<McpTestServerHandle> => {
  let app = express();
  let mcpServer = createFullFeaturedServer();

  await setupTransports(app, mcpServer, '/full');

  let startListening = async (port: number) =>
    await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      let server = app.listen(port, () => resolve(server));
      server.once('error', reject);
    });

  let preferredPort = Number(process.env.TEST_MCP_SERVER_PORT ?? 52198);
  let listener: ReturnType<typeof app.listen>;
  try {
    listener = await startListening(preferredPort);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
    listener = await startListening(0);
  }

  let port = (listener.address() as AddressInfo).port;
  // The test server runs on the host machine, but Shuttle (inside Docker) reaches it
  // via host.docker.internal. On Linux, ensure Docker is configured with
  // --add-host=host.docker.internal:host-gateway
  let host = process.env.TEST_MCP_SERVER_HOST ?? 'host.docker.internal';
  let baseUrl = `http://${host}:${port}`;

  return { listener, port, baseUrl };
};

export let stopMcpTestServer = async (
  handle: McpTestServerHandle,
  opts: { timeoutMs?: number } = {}
) => {
  let listener = handle.listener as Server & {
    closeAllConnections?: () => void;
    closeIdleConnections?: () => void;
  };

  let timeoutMs = opts.timeoutMs ?? 10_000;

  await new Promise<void>(resolve => {
    let settled = false;
    let finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    let timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    listener.close(() => finish());
    listener.closeIdleConnections?.();
    listener.closeAllConnections?.();
  });
};
