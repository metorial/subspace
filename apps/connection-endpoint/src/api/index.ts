import { createHono } from '@lowerdeck/hono';
import {
  providerToolPresenter,
  SenderConnection,
  SenderManager
} from '@metorial-subspace/module-connection';
import { ConResponse } from '@metorial-subspace/module-connection/src/lib/response';
import { invalidRequest } from '@metorial-subspace/module-connection/src/types/error';
import { websocket } from 'hono/bun';
import { streamSSE } from 'hono/streaming';
import z from 'zod';
import { useValidation } from '../lib/validator';

export { websocket };

export let api = createHono()
  .get('/sessions/:sessionId/live', c =>
    streamSSE(c, async stream => {
      let channelIds = c.req.query('channel_ids')?.split(',').filter(Boolean) ?? [];

      let con = await SenderConnection.create({
        sessionId: c.req.param('sessionId'),
        channelIds
      });

      await stream.writeSSE({
        data: JSON.stringify({ type: 'connected' })
      });

      let listenerStream = con.listener();

      stream.onAbort(() => {
        listenerStream.close();
      });

      for await (let event of listenerStream) {
        await stream.writeSSE({
          data: JSON.stringify(event)
        });
      }
    })
  )
  .post(
    '/sessions/:sessionId/initialize',
    useValidation(
      'json',
      z.object({
        client: z.object({ identifier: z.string(), name: z.string() }).loose()
      })
    ),
    async c => {
      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')
      });

      let body = c.req.valid('json');

      let initRes = await manager.setClient({
        client: body.client
      });

      return c.json({ ok: true });
    }
  )
  .get('/sessions/:sessionId/tool.list', async c => {
    let manager = await SenderManager.create({
      sessionId: c.req.param('sessionId')
    });

    let tools = await manager.listTools();

    return c.json(tools.map(t => providerToolPresenter(t)));
  })
  .get(
    '/sessions/:sessionId/tool.get',
    useValidation('query', z.object({ toolId: z.string() })),
    async c => {
      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')
      });

      let toolId = c.req.valid('query').toolId;
      if (!toolId) return c.json(invalidRequest('toolId is required'), 400);

      let tools = await manager.getToolById({
        toolId
      });
      if (ConResponse.isError(tools)) return c.json(tools, 400);

      return c.json(providerToolPresenter(tools.data!.tool));
    }
  )
  .post(
    '/sessions/:sessionId/tool.call',
    useValidation(
      'json',
      z.object({
        toolId: z.string(),
        input: z.record(z.string(), z.any()),
        waitForResponse: z.boolean().optional()
      })
    ),
    async c => {
      let body = c.req.valid('json');

      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')
      });

      let toolRes = await manager.callTool({
        toolId: body.toolId,
        input: body.input,
        waitForResponse: !!body.waitForResponse
      });

      return c.json(toolRes);
    }
  );
