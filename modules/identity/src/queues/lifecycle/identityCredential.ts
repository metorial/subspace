import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';

export let identityCredentialCreatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/created',
  redisUrl: env.service.REDIS_URL
});

export let identityCredentialCreatedQueueProcessor = identityCredentialCreatedQueue.process(
  async data => {
    // TODO: reconcile
  }
);

export let identityCredentialUpdatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/updated',
  redisUrl: env.service.REDIS_URL
});

export let identityCredentialUpdatedQueueProcessor = identityCredentialUpdatedQueue.process(
  async data => {
    // TODO: reconcile
  }
);

export let identityCredentialDeletedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/deleted',
  redisUrl: env.service.REDIS_URL
});

export let identityCredentialDeletedQueueProcessor = identityCredentialDeletedQueue.process(
  async data => {
    // TODO: reconcile
  }
);
