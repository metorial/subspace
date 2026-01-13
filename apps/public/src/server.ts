import { apiMux } from '@lowerdeck/api-mux';
import { rpcMux } from '@lowerdeck/rpc-server';
import { subspaceFrontendRPC } from './api/internal';
import { app } from './api/public';

let server = Bun.serve({
  fetch: apiMux(
    [{ endpoint: rpcMux({ path: '/subspace-public/internal-api' }, [subspaceFrontendRPC]) }],
    app.fetch as any
  ),
  port: 52071
});

console.log(`Service running on http://localhost:${server.port}`);
