import { db } from '@metorial-subspace/db';
import { redis } from 'bun';
import { subspaceControllerApi } from './controllers';

let server = Bun.serve({
  fetch: subspaceControllerApi,
  port: 52070
});

console.log(`Service running on http://localhost:${server.port}`);

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
