import { parseRedisUrl } from '@metorial-subspace/redis-url';
import { createRedisNatsWire, createWire } from '@metorial-subspace/wire';
import { env } from '../env';

export let wire = createWire(
  createRedisNatsWire({
    wireId: 'subspace-connection',
    redisConfig: parseRedisUrl(env.service.REDIS_URL),
    natsConfig: {
      servers: env.service.NATS_URL.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    }
  })
);
