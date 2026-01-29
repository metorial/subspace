import { Service } from '@lowerdeck/service';
import {
  db,
  Environment,
  type ProviderRun,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';

export type ProviderRunLog = {
  timestamp: number;
  message: string;
  toolCallId: string;
  slateSessionId: string;
};

class providerRunLogsServiceImpl {
  async getProviderRunLogs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerRun: ProviderRun;
  }) {
    let fullProviderRun = await db.providerRun.findFirstOrThrow({
      where: { oid: d.providerRun.oid },
      include: { providerVersion: true }
    });

    let backend = await getBackend({ entity: fullProviderRun.providerVersion });

    let allLogs = await backend.toolInvocation.getProviderRunLogs({
      providerRun: fullProviderRun,
      tenant: d.tenant
    });

    return {
      object: 'provider.run.logs',
      providerRunId: d.providerRun.id,
      logs: allLogs
    };
  }
}

export let providerRunLogsService = Service.create(
  'providerRunLogs',
  () => new providerRunLogsServiceImpl()
).build();
