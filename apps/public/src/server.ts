import { app } from './controllers';

let server = Bun.serve({
  fetch: app.fetch,
  port: 52071
});

console.log(`Service running on http://localhost:${server.port}`);
