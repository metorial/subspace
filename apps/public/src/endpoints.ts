import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '@metorial-subspace/db';
import { RedisClient } from 'bun';
import { subspaceFrontendRPC } from './api/internal';
import { app } from './api/public';

let Sentry = getSentry();

let server = Bun.serve({
  fetch: apiMux(
    [{ endpoint: rpcMux({ path: '/subspace-public/internal-api' }, [subspaceFrontendRPC]) }],
    app.fetch as any
  ),
  port: 52071
});

console.log(`Service running on http://localhost:${server.port}`);

Bun.serve({
  fetch: async _ => {
    try {
      await db.backend.count();

      let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
        tls: process.env.REDIS_URL?.startsWith('rediss://')
      });
      await redis.ping();

      return new Response('OK');
    } catch (e) {
      Sentry.captureException(e);
      return new Response('Service Unavailable', { status: 503 });
    }
  },
  port: 12121
});
