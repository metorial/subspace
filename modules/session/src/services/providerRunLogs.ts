import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Solution, type Tenant } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';

export type ProviderRunLog = {
  timestamp: number;
  message: string;
  toolCallId: string;
  slateSessionId: string;
};

class providerRunLogsServiceImpl {
  async getProviderRunLogs(d: { tenant: Tenant; solution: Solution; providerRunId: string }) {
    let providerRun = await db.providerRun.findFirst({
      where: {
        id: d.providerRunId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include: {
        providerVersion: true,
        slateSessions: {
          include: {
            slateToolInvocations: true
          }
        }
      }
    });

    if (!providerRun) {
      throw new ServiceError(notFoundError('provider.run', d.providerRunId));
    }

    let backend = await getBackend({ entity: providerRun.providerVersion });

    let allLogs: ProviderRunLog[] = [];

    // Fetch logs for each tool call across all slate sessions
    for (let slateSession of providerRun.slateSessions) {
      for (let toolCall of slateSession.slateToolInvocations) {
        try {
          let res = await backend.toolInvocation.getToolInvocationLogs({
            tenant: d.tenant,
            slateToolCallId: toolCall.id
          });

          // Add logs with context
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
          // Continue with other tool calls
        }
      }
    }

    // Sort logs by timestamp
    allLogs.sort((a, b) => a.timestamp - b.timestamp);

    return {
      object: 'provider.run.logs',
      providerRunId: d.providerRunId,
      logs: allLogs
    };
  }
}

export let providerRunLogsService = Service.create(
  'providerRunLogs',
  () => new providerRunLogsServiceImpl()
).build();
