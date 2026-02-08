import { db } from '@metorial-subspace/db';
import { redis } from 'bun';

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
