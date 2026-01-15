import { createRedisNatsWire, createWire } from '@metorial-subspace/wire';
import { env } from '../env';
import { parseRedisUrl } from './parseRedisUrl';

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
