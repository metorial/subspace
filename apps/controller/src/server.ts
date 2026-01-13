import { subspaceControllerApi } from './controllers';

import './worker';

let server = Bun.serve({
  fetch: subspaceControllerApi,
  port: 52070
});

console.log(`Service running on http://localhost:${server.port}`);
