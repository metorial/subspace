import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://localhost/test',
      PUBLIC_SERVICE_URL: 'http://localhost:3000',
      REDIS_URL: 'redis://localhost:6379',
      SLATES_HUB_URL: 'http://localhost:4000',
      SLATES_HUB_PUBLIC_URL: 'http://localhost:4000'
    }
  }
});
