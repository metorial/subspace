import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Solution, type Tenant } from '@metorial-subspace/db';
import { createSlatesHubInternalClient } from '@metorial-services/slates-hub-client';
import { env } from '../env';

export type ProviderRunLog = {
  timestamp: number;
  message: string;
  toolCallId: string;
  slateSessionId: string;
};

let getSlatesClient = () =>
  createSlatesHubInternalClient({
    endpoint: env.service.SLATES_HUB_URL
  });

class providerRunLogsServiceImpl {
  async getProviderRunLogs(d: {
    tenant: Tenant;
    solution: Solution;
    providerRunId: string;
  }): Promise<{
    object: 'provider.run.logs';
    providerRunId: string;
    logs: ProviderRunLog[];
  }> {
    let providerRun = await db.providerRun.findFirst({
      where: {
        id: d.providerRunId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include: {
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

    // If tenant doesn't have a slateTenantId, return empty logs
    if (!d.tenant.slateTenantId) {
      return {
        object: 'provider.run.logs',
        providerRunId: d.providerRunId,
        logs: []
      };
    }

    let slates = getSlatesClient();
    let allLogs: ProviderRunLog[] = [];

    // Fetch logs for each tool call across all slate sessions
    for (let slateSession of providerRun.slateSessions) {
      for (let toolCall of slateSession.slateToolInvocations) {
        try {
          let res = await slates.slateSessionToolCall.getLogs({
            tenantId: d.tenant.slateTenantId,
            slateSessionToolCallId: toolCall.id
          });

          // Add logs with context
          for (let log of res.invocation.logs) {
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
