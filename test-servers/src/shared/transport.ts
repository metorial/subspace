import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';

type ServerFactory = () => McpServer;
type SseSession = {
  server: McpServer;
  transport: SSEServerTransport;
};

const INTERNAL_SERVER_ERROR = 'Internal server error';
const SESSION_ID_REQUIRED = 'Session ID is required';

const firstString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const getSessionId = (req: Request) => {
  return firstString(req.query.sessionId) ?? firstString(req.params.sessionId);
};

const sendJsonError = (res: Response, statusCode: number, message: string) => {
  if (!res.headersSent) {
    res.status(statusCode).json({ error: message });
  }
};

const closeWithLog = (label: string, closeFn: () => Promise<void>) => {
  // biome-ignore lint/complexity/noVoid: <>
  void closeFn().catch(err => {
    console.error(label, err);
  });
};

export async function setupTransports(
  app: Express,
  createServer: ServerFactory,
  basePath: string = ''
) {
  app.use(cors());
  app.use(express.json());

  const ssePath = `${basePath}/sse`;
  const sseMessagePath = `${basePath}/message`;
  const mcpPath = `${basePath}/mcp`;
  const sseSessions = new Map<string, SseSession>();

  // Streamable HTTP runs against a single long-lived server instance.
  const httpServer = createServer();
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined // Stateless mode
  });
  await httpServer.connect(httpTransport);

  app.get(ssePath, async (req: Request, res: Response) => {
    console.log(`SSE connection established at ${ssePath}`);

    // Each SSE client gets an isolated MCP server instance.
    const transport = new SSEServerTransport(sseMessagePath, res);
    const sessionId = transport.sessionId;
    const sseServer = createServer();

    sseSessions.set(sessionId, { transport, server: sseServer });

    try {
      await sseServer.connect(transport);
    } catch (error) {
      sseSessions.delete(sessionId);
      console.error(`Error establishing SSE session ${sessionId}:`, error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
      return;
    }

    req.on('close', () => {
      console.log(`SSE connection closed at ${ssePath} for session ${sessionId}`);
      sseSessions.delete(sessionId);

      closeWithLog(`Error closing SSE server for session ${sessionId}:`, () => sseServer.close());
      closeWithLog(`Error closing SSE transport for session ${sessionId}:`, () => transport.close());
    });
  });

  const handleSseMessage = async (req: Request, res: Response) => {
    const sessionId = getSessionId(req);

    if (!sessionId) {
      sendJsonError(res, 400, SESSION_ID_REQUIRED);
      return;
    }

    const session = sseSessions.get(sessionId);
    if (!session) {
      sendJsonError(res, 404, `Session not found: ${sessionId}`);
      return;
    }

    try {
      await session.transport.handlePostMessage(req as any, res as any, req.body);
    } catch (error) {
      console.error(`Error handling SSE message for session ${sessionId}:`, error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
    }
  };

  app.post(sseMessagePath, handleSseMessage);
  app.post(`${sseMessagePath}/:sessionId`, handleSseMessage);

  app.all(mcpPath, async (req: Request, res: Response) => {
    console.log(`${req.method} request received at ${mcpPath}`);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
      await httpTransport.handleRequest(req as any, res as any, req.body);
      console.log('Request handled successfully');
    } catch (error) {
      console.error('Error handling streamable HTTP request:', error);
      sendJsonError(res, 500, INTERNAL_SERVER_ERROR);
    }
  });
}
