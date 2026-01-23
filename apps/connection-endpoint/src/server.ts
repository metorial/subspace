import './instrument';

import { db } from '@metorial-subspace/db';
import { redis } from 'bun';
import { api } from './api';
import { websocket } from './api/metorialIntegrationProtocol';

Bun.serve({
  fetch: api.fetch,
  websocket,
  port: 52072,
  idleTimeout: 0
});

Bun.serve({
  fetch: async _ => {
    try {
      await db.backend.count();
      await redis.ping();
      return new Response('OK');
    } catch (e) {
      return new Response('Service Unavailable', { status: 503 });
    }
  },
  port: 12121
});
