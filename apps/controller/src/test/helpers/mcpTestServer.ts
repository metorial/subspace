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
  let listener = await (async () => {
    try {
      return await startListening(preferredPort);
    } catch (err) {
      let code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE') throw err;
      return await startListening(0);
    }
  })();

  let port = (listener.address() as AddressInfo).port;
  let host = process.env.TEST_MCP_SERVER_HOST ?? 'host.docker.internal';
  let baseUrl = `http://${host}:${port}`;

  return { listener, port, baseUrl };
};

export let stopMcpTestServer = async (handle: McpTestServerHandle) => {
  let listener = handle.listener as Server & {
    closeAllConnections?: () => void;
    closeIdleConnections?: () => void;
  };

  await new Promise<void>(resolve => {
    listener.close(() => resolve());
    listener.closeIdleConnections?.();
    listener.closeAllConnections?.();
  });
};
