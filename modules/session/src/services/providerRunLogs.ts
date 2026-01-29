import { Service } from '@lowerdeck/service';
import { db, type ProviderRun, type Solution, type Tenant } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import PQueue from 'p-queue';

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
      include: {
        providerVersion: true,
        slateSessions: {
          include: {
            slateToolInvocations: {
              take: 100,
              orderBy: { oid: 'desc' }
            }
          }
        }
      }
    });

    let backend = await getBackend({ entity: fullProviderRun.providerVersion });

    let allLogs: ProviderRunLog[] = [];
    let queue = new PQueue({ concurrency: 5 });

    for (let slateSession of fullProviderRun.slateSessions) {
      for (let toolCall of slateSession.slateToolInvocations) {
        queue.add(async () => {
          try {
            let res = await backend.toolInvocation.getToolInvocationLogs({
              tenant: d.tenant,
              slateToolCallId: toolCall.id
            });

            for (let log of res.logs) {
              allLogs.push({
                timestamp: log.timestamp,
                message: log.message,
                toolCallId: toolCall.id,
                slateSessionId: slateSession.id
              });
            }
          } catch {
            // Individual tool call log fetch failures should not fail the entire request
          }
        });
      }
    }

    await queue.onIdle();

    // Sort logs by timestamp
    allLogs.sort((a, b) => a.timestamp - b.timestamp);

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
