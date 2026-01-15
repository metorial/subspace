import { createHono } from '@lowerdeck/hono';
import {
  providerToolPresenter,
  SenderConnection,
  SenderManager
} from '@metorial-subspace/module-connection';
import { websocket } from 'hono/bun';
import { streamSSE } from 'hono/streaming';
import z from 'zod';
import { useValidation } from '../lib/validator';

export { websocket };

export let api = createHono()
  .get('/sessions/:sessionId/connection', c =>
    streamSSE(c, async stream => {
      let channelIds = c.req.query('channel_ids')?.split(',').filter(Boolean) ?? [];

      let con = await SenderConnection.create({
        sessionId: c.req.param('sessionId'),
        channelIds
      });
    })
  )
  .get('/sessions/:sessionId/tools', async c => {
    let manager = await SenderManager.create({
      sessionId: c.req.param('sessionId')
    });

    let tools = await manager.listTools();

    return c.json({
      tools: tools.map(t => providerToolPresenter(t))
    });
  })
  .post(
    '/sessions/:sessionId/call_tool',
    useValidation(
      'json',
      z.object({
        toolId: z.string(),
        input: z.record(z.string(), z.any())
      })
    ),
    async c => {
      let body = c.req.valid('json');

      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')
      });

      let toolRes = await manager.callTool({
        toolId: body.toolId,
        input: body.input
      });

      return c.json(toolRes);
    }
  );
