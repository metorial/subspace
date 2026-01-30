import { createQueue } from '@lowerdeck/queue';
import { snowflake, withTransaction } from '@metorial-subspace/db';
import { shuttle, shuttleDefaultReaderTenant } from '../../client';
import { env } from '../../env';
import { upsertShuttleServerVersion } from '../../lib/upsertShuttleVersion';

export let syncShuttleVersionQueue = createQueue<{
  serverId: string;
  serverVersionId: string;
  tenantId: string | undefined;
}>({
  name: 'kst/shut/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

export let syncShuttleVersionQueueProcessor = syncShuttleVersionQueue.process(async data => {
  let version = await shuttle.serverVersion.get({
    serverVersionId: data.serverVersionId,
    tenantId: data.tenantId ?? shuttleDefaultReaderTenant.id
  });

  let server = await shuttle.server.get({
    serverId: version.serverId,
    tenantId: version.tenantId ?? shuttleDefaultReaderTenant.id
  });

  await withTransaction(async db => {
    let shuttleServerRecord = await db.shuttleServer.upsert({
      where: { id: data.serverId },
      create: {
        oid: snowflake.nextId(),
        id: server.id,
        identifier: server.id,
        shuttleTenantId: server.tenantId!,
        type: server.type
      },
      update: {}
    });

    let newShuttleServerVersionRecord = snowflake.nextId();
    let shuttleServerVersionRecord = await db.shuttleServerVersion.upsert({
      where: { id: version.id },
      create: {
        oid: newShuttleServerVersionRecord,
        id: version.id,
        version: version.id,
        identifier: `${server.id}::${version.id}`,
        serverOid: shuttleServerRecord.oid
      },
      update: {}
    });

    // Abort if the version already existed
    if (shuttleServerVersionRecord.oid != newShuttleServerVersionRecord) {
      return;
    }

    await upsertShuttleServerVersion({
      shuttleServer: server,
      shuttleServerVersion: version,

      shuttleServerRecord,
      shuttleServerVersionRecord
    });
  });
});
