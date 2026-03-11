import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { lcOpts } from './_opts';

export let identityCredentialCreatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialCreatedQueueProcessor = identityCredentialCreatedQueue.process(
  async data => {
    // TODO: reconcile
  }
);

export let identityCredentialUpdatedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialUpdatedQueueProcessor = identityCredentialUpdatedQueue.process(
  async data => {
    // TODO: reconcile
  }
);

export let identityCredentialDeletedQueue = createQueue<{ identityCredentialId: string }>({
  name: 'sub/idn/lc/identityCredential/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityCredentialDeletedQueueProcessor = identityCredentialDeletedQueue.process(
  async data => {
    // TODO: reconcile
  }
);
