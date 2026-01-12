import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { indexProviderAuthCredentialsQueue } from '../search/providerAuthCredentials';

export let providerAuthCredentialsCreatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'auth/lc/providerAuthCredentials/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsCreatedQueueProcessor =
  providerAuthCredentialsCreatedQueue.process(async data => {
    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });

export let providerAuthCredentialsUpdatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'auth/lc/providerAuthCredentials/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsUpdatedQueueProcessor =
  providerAuthCredentialsUpdatedQueue.process(async data => {
    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });
