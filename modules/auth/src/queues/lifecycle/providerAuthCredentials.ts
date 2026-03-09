import { createQueue } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import { env } from '../../env';
import { indexProviderAuthCredentialsQueue } from '../search/providerAuthCredentials';

export let providerAuthCredentialsCreatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/created',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsCreatedQueueProcessor =
  providerAuthCredentialsCreatedQueue.process(async data => {
    let providerAuthCredentials = await db.providerAuthCredentials.findUniqueOrThrow({
      where: { id: data.providerAuthCredentialsId }
    });

    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });

    await db.providerUse.upsert({
      where: {
        tenantOid_solutionOid_environmentOid_providerOid: {
          tenantOid: providerAuthCredentials.tenantOid,
          solutionOid: providerAuthCredentials.solutionOid,
          environmentOid: providerAuthCredentials.environmentOid,
          providerOid: providerAuthCredentials.providerOid
        }
      },
      create: {
        ...getId('providerUse'),
        tenantOid: providerAuthCredentials.tenantOid,
        solutionOid: providerAuthCredentials.solutionOid,
        environmentOid: providerAuthCredentials.environmentOid,
        providerOid: providerAuthCredentials.providerOid,
        credentials: 1
      },
      update: {
        credentials: { increment: 1 }
      }
    });
  });

export let providerAuthCredentialsUpdatedQueue = createQueue<{
  providerAuthCredentialsId: string;
}>({
  name: 'sub/auth/lc/providerAuthCredentials/updated',
  redisUrl: env.service.REDIS_URL
});

export let providerAuthCredentialsUpdatedQueueProcessor =
  providerAuthCredentialsUpdatedQueue.process(async data => {
    await indexProviderAuthCredentialsQueue.add({
      providerAuthCredentialsId: data.providerAuthCredentialsId
    });
  });
