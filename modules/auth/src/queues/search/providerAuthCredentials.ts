import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { env } from '../../env';

export let indexProviderAuthCredentialsQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'auth/sidx/providerAuthCredentials',
  redisUrl: env.service.REDIS_URL
});

export let indexProviderAuthCredentialsQueueProcessor =
  indexProviderAuthCredentialsQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUnique({
      where: { id: data.providerAuthCredentialsId },
      include: { tenant: true, provider: true }
    });
    if (!providerAuthCredentials) throw new QueueRetryError();

    if (!providerAuthCredentials.name && !providerAuthCredentials.description) {
      await voyager.record.delete({
        sourceId: voyagerSource.id,
        indexId: voyagerIndex.providerAuthCredentials.id,
        documentIds: [providerAuthCredentials.id]
      });
      return;
    }

    await voyager.record.index({
      sourceId: voyagerSource.id,
      indexId: voyagerIndex.providerAuthCredentials.id,

      documentId: providerAuthCredentials.id,
      tenantIds: [providerAuthCredentials.tenant.id],

      fields: {
        providerId: providerAuthCredentials.provider.id,
        configId: providerAuthCredentials.id
      },
      body: {
        name: providerAuthCredentials.name,
        description: providerAuthCredentials.description,
        providerName: providerAuthCredentials.provider.name
      }
    });
  });
