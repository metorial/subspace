import { api, websocket } from './api';

Bun.serve({
  fetch: api.fetch,
  websocket,
  port: 52072
});
