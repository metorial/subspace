import { app } from './api/public';

let server = Bun.serve({
  fetch: app.fetch,
  port: 52071
});

console.log(`Service running on http://localhost:${server.port}`);
