import { createQueue } from '@lowerdeck/queue';
import { env } from '../../../../agent/src/env';
import { indexAgentQueue } from '../search/agent';

export let agentCreatedQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/lc/agent/created',
  redisUrl: env.service.REDIS_URL
});

export let agentCreatedQueueProcessor = agentCreatedQueue.process(async data => {
  await indexAgentQueue.add({ agentId: data.agentId });
});

export let agentUpdatedQueue = createQueue<{ agentId: string }>({
  name: 'sub/idn/lc/agent/updated',
  redisUrl: env.service.REDIS_URL
});

export let agentUpdatedQueueProcessor = agentUpdatedQueue.process(async data => {
  await indexAgentQueue.add({ agentId: data.agentId });
});
