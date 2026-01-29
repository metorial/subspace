import { db, snowflake } from '@metorial-subspace/db';
import type {
  ProviderRunCreateParam,
  ProviderRunCreateRes,
  ProviderRunLogsParam,
  ProviderRunLogsRes,
  ToolInvocationCreateParam,
  ToolInvocationCreateRes
} from '@metorial-subspace/provider-utils';
import { IProviderToolInvocation } from '@metorial-subspace/provider-utils';
import PQueue from 'p-queue';
import { getTenantForShuttle, shuttle } from '../client';

export class ProviderToolInvocation extends IProviderToolInvocation {
  override async createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes> {
    if (
      !data.providerVariant.shuttleServerOid ||
      !data.providerConfigVersion.shuttleConfigOid ||
      !data.providerVersion.shuttleServerVersionOid ||
      (data.providerAuthConfigVersion && !data.providerAuthConfigVersion.shuttleAuthConfigOid)
    ) {
      throw new Error('Provider data is missing required slate associations');
    }

    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServer = await db.shuttleServer.findUniqueOrThrow({
      where: { oid: data.providerVariant.shuttleServerOid }
    });
    let shuttleConfig = await db.shuttleServerConfig.findUniqueOrThrow({
      where: { oid: data.providerConfigVersion.shuttleConfigOid }
    });
    let shuttleVersion = await db.shuttleServerVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.shuttleServerVersionOid }
    });
    let shuttleAuthConfig = data.providerAuthConfigVersion?.shuttleAuthConfigOid
      ? await db.shuttleAuthConfig.findUniqueOrThrow({
          where: { oid: data.providerAuthConfigVersion.shuttleAuthConfigOid }
        })
      : null;

    let res = await shuttle.serverConnection.create({
      tenantId: tenant.id,
      serverVersionId: shuttleVersion.id,
      serverConfigId: shuttleConfig.id,
      serverAuthConfigId: shuttleAuthConfig?.id,

      client: data.mcp?.clientInfo ?? {
        name: data.participant.name,
        version: '1.0.0'
      },
      capabilities: data.mcp?.capabilities ?? {}

      // TODO: @herber add networkRulesetIds
    });

    let shuttleConnection = await db.shuttleConnection.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,
        shuttleServerOid: shuttleServer.oid,
        shuttleServerVersionOid: shuttleVersion.oid,
        providerRunOid: data.providerRun.oid
      }
    });

    return {
      shuttleConnection,
      runState: { sessionId: shuttleConnection.id }
    };
  }

  override async createToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes> {
    throw new Error('Method not implemented.');
  }

  override async getProviderRunLogs(data: ProviderRunLogsParam): Promise<ProviderRunLogsRes> {
    let tenant = await getTenantForShuttle(data.tenant);

    let connections = await db.shuttleConnection.findMany({
      where: { providerRunOid: data.providerRun.oid },
      take: 10
    });

    let queue = new PQueue({ concurrency: 5 });

    let logs = await queue.addAll(
      connections.map(conn => async () => {
        let res = await shuttle.serverConnection.getLogs({
          tenantId: tenant.id,
          serverConnectionId: conn.id
        });

        return (res ?? []).map(log => ({
          outputType: log.outputType,
          timestamp: log.timestamp,
          message: log.message
        }));
      })
    );

    let sorted = logs.flat().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      logs: sorted
    };
  }
}
