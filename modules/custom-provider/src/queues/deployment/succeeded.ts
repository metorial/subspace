import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId, withTransaction } from '@metorial-subspace/db';
import { getTenantForShuttle, shuttle } from '@metorial-subspace/provider-shuttle/src/client';
import { upsertShuttleServerVersion } from '@metorial-subspace/provider-shuttle/src/lib/upsertShuttleVersion';
import { env } from '../../env';

export let customDeploymentSucceededQueue = createQueue<{
  customProviderDeploymentId: string;
}>({
  name: 'cpr/deployment/succeeded',
  redisUrl: env.service.REDIS_URL
});

export let customDeploymentSucceededQueueProcessor = customDeploymentSucceededQueue.process(
  async data => {
    let deployment = await db.customProviderDeployment.findFirst({
      where: { id: data.customProviderDeploymentId },
      include: {
        tenant: true,
        customProviderVersion: true,
        shuttleCustomServer: { include: { server: true } },
        shuttleServerVersion: true,
        sourceEnvironment: true,
        commit: true
      }
    });
    let customProviderVersion = deployment?.customProviderVersion;
    let shuttleServerRecord = deployment?.shuttleCustomServer?.server;
    let shuttleServerVersionRecord = deployment?.shuttleServerVersion;
    if (!deployment) throw new QueueRetryError();
    if (!customProviderVersion || !shuttleServerRecord || !shuttleServerVersionRecord) return;

    let tenant = await getTenantForShuttle(deployment.tenant);

    let shuttleServer = await shuttle.server.get({
      serverId: shuttleServerRecord!.id,
      tenantId: tenant.id
    });
    let shuttleServerVersion = await shuttle.serverVersion.get({
      serverVersionId: shuttleServerVersionRecord!.id,
      tenantId: tenant.id
    });

    await withTransaction(async db => {
      await db.customProviderDeployment.updateMany({
        where: { id: deployment.id },
        data: {
          status: 'succeeded',
          startedAt: deployment.startedAt ?? new Date(),
          endedAt: deployment.endedAt ?? new Date()
        }
      });

      let versionRes = await upsertShuttleServerVersion({
        shuttleServer,
        shuttleServerVersion,

        shuttleServerRecord,
        shuttleServerVersionRecord
      });
      let provider = versionRes.provider;
      let version = versionRes.providerVersion;

      await db.customProviderVersion.updateMany({
        where: { oid: customProviderVersion.oid },
        data: {
          status: 'deployment_succeeded',
          providerVersionOid: versionRes.providerVersion.oid
        }
      });
      await db.customProvider.updateMany({
        where: { oid: customProviderVersion.customProviderOid },
        data: {
          providerOid: provider.oid,
          providerVariantOid: provider.defaultVariantOid
        }
      });

      let environments = await db.customProviderEnvironment.findMany({
        where: { customProviderOid: customProviderVersion.customProviderOid }
      });
      let newProviderEnvironments = await db.providerEnvironment.createManyAndReturn({
        skipDuplicates: true,
        data: environments.map(env => ({
          ...getId('providerEnvironment'),
          tenantOid: deployment.tenantOid,
          environmentOid: env.environmentOid,
          providerOid: provider.oid,
          providerVariantOid: provider.defaultVariantOid!
        }))
      });

      for (let env of newProviderEnvironments) {
        let matchingCustomEnv = environments.find(e => e.environmentOid == env.environmentOid);
        if (!matchingCustomEnv) continue;

        await db.customProviderEnvironment.updateMany({
          where: { oid: matchingCustomEnv.oid },
          data: { providerEnvironmentOid: env.oid }
        });
      }

      let isEnvironmentLocked = false;

      if (deployment.commit && deployment.sourceEnvironment) {
        isEnvironmentLocked = true;

        let res = await db.customProviderEnvironmentVersion.upsert({
          where: {
            customProviderEnvironmentOid_customProviderVersionOid: {
              customProviderEnvironmentOid: deployment.sourceEnvironment.oid,
              customProviderVersionOid: customProviderVersion.oid
            }
          },
          create: {
            ...getId('customProviderEnvironmentVersion'),
            customProviderEnvironmentOid: deployment.sourceEnvironment.oid,
            customProviderVersionOid: customProviderVersion.oid,
            environmentOid: deployment.sourceEnvironment.environmentOid,
            commitOid: deployment.commit.oid
          },
          update: {}
        });
        let sourceEnvFull = await db.customProviderEnvironment.findUniqueOrThrow({
          where: { oid: deployment.sourceEnvironment.oid },
          include: {
            providerEnvironment: {
              include: {
                currentVersion: {
                  include: { customProviderVersion: true }
                }
              }
            }
          }
        });

        await db.customProviderCommit.updateMany({
          where: { oid: deployment.commit.oid },
          data: {
            status: 'applied',
            appliedAt: new Date(),
            toEnvironmentOid: sourceEnvFull.oid,
            toEnvironmentVersionBeforeOid:
              sourceEnvFull.providerEnvironment?.currentVersion?.customProviderVersion?.oid
          }
        });

        await db.providerEnvironmentVersion.upsert({
          where: {
            providerEnvironmentOid_providerVersionOid: {
              providerEnvironmentOid: sourceEnvFull.providerEnvironment!.oid,
              providerVersionOid: version.oid
            }
          },
          create: {
            ...getId('providerEnvironmentVersion'),
            providerEnvironmentOid: sourceEnvFull.providerEnvironment!.oid,
            providerVersionOid: version.oid,
            environmentOid: sourceEnvFull.environmentOid
          },
          update: {}
        });

        await db.providerEnvironment.updateMany({
          where: { oid: sourceEnvFull.providerEnvironment!.oid },
          data: { currentVersionOid: version.oid }
        });
      }

      if (isEnvironmentLocked) {
        await db.providerVersion.updateMany({
          where: { oid: provider.oid },
          data: { isEnvironmentLocked: true }
        });

        await db.provider.updateMany({
          where: { oid: provider.oid },
          data: { hasEnvironments: true }
        });
      }
    });
  }
);
