import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let customDeploymentFailedQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'cpr/deployment/failed',
  redisUrl: env.service.REDIS_URL
});

export let customDeploymentFailedQueueProcessor = customDeploymentFailedQueue.process(
  async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: { customProviderVersion: true }
    });
    if (!deployment || !deployment.customProviderVersion) throw new QueueRetryError();

    await db.customProviderDeployment.updateMany({
      where: { id: deployment.id },
      data: {
        status: 'failed',
        startedAt: deployment.startedAt ?? new Date(),
        endedAt: deployment.endedAt ?? new Date()
      }
    });

    await db.customProviderVersion.updateMany({
      where: {
        oid: deployment.customProviderVersion.oid
      },
      data: {
        status: 'deployment_failed'
      }
    });
  }
);
