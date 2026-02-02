import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';

export async function setupTransports(
  app: Express,
  mcpServer: McpServer,
  basePath: string = ''
) {
  app.use(cors());
  app.use(express.json());

  // Store SSE transports by session ID to handle message routing
  const sseTransports = new Map<string, SSEServerTransport>();

  // Create the streamable HTTP transport (stateless mode)
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Connect server to the HTTP transport
  await mcpServer.connect(httpTransport);

  // SSE endpoint
  app.get(`${basePath}/sse`, async (req: Request, res: Response) => {
    console.log(`SSE connection established at ${basePath}/sse`);

    // Create a placeholder transport to generate session ID
    const tempTransport = new SSEServerTransport(`${basePath}/message/temp`, res);

    // We need to create it and get the session ID before starting
    const sessionId = tempTransport.sessionId;

    // Now create the real transport with the correct path
    const transport = new SSEServerTransport(`${basePath}/message/${sessionId}`, res);

    // Store the transport for message routing
    sseTransports.set(sessionId, transport);

    // Connect the MCP server to this transport (this will call start() automatically)
    await mcpServer.connect(transport);

    req.on('close', () => {
      console.log(`SSE connection closed at ${basePath}/sse for session ${sessionId}`);
      sseTransports.delete(sessionId);
      transport.close();
    });
  });

  // SSE message endpoint with session ID as path parameter
  app.post(`${basePath}/message/:sessionId`, async (req: Request, res: Response) => {
    const sessionIdParam = req.params.sessionId;
    const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const transport = sseTransports.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: `Session not found: ${sessionId}` });
      return;
    }

    try {
      await transport.handlePostMessage(req as any, res as any, req.body);
    } catch (error) {
      console.error(`Error handling SSE message for session ${sessionId}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Streamable HTTP endpoint - handles both GET (SSE) and POST (JSON-RPC)
  app.all(`${basePath}/mcp`, async (req: Request, res: Response) => {
    console.log(`${req.method} request received at ${basePath}/mcp`);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
      await httpTransport.handleRequest(req as any, res as any, req.body);
      console.log('Request handled successfully');
    } catch (error) {
      console.error('Error handling streamable HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
}
