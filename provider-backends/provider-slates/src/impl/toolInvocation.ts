import { db, messageInputToToolCall, snowflake } from '@metorial-subspace/db';
import type {
  ProviderRunCreateParam,
  ProviderRunCreateRes,
  ToolInvocationCreateParam,
  ToolInvocationCreateRes
} from '@metorial-subspace/provider-utils';
import { IProviderToolInvocation } from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';

export class ProviderToolInvocation extends IProviderToolInvocation {
  override async createProviderRun(
    data: ProviderRunCreateParam
  ): Promise<ProviderRunCreateRes> {
    if (
      !data.providerVariant.slateOid ||
      !data.providerConfigVersion.slateInstanceOid ||
      !data.providerVersion.slateVersionOid
    ) {
      throw new Error('Provider data is missing required slate associations');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slate = await db.slate.findUniqueOrThrow({
      where: { oid: data.providerVariant.slateOid }
    });
    let slateInstance = await db.slateInstance.findUniqueOrThrow({
      where: { oid: data.providerConfigVersion.slateInstanceOid }
    });
    let slateVersion = await db.slateVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.slateVersionOid }
    });

    let res = await slates.slateSession.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateInstanceId: slateInstance.id,
      lockedSlateVersion: slateVersion.id
    });

    let slateSession = await db.slateSession.create({
      data: {
        oid: snowflake.nextId(),
        id: res.id,
        providerRunOid: data.providerRun.oid
      }
    });

    return {
      slateSession,
      runState: { sessionId: slateSession.id }
    };
  }

  override async createToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes> {
    if (data.providerAuthConfigVersion && !data.providerAuthConfigVersion.slateAuthConfigOid) {
      throw new Error('Provider auth config is missing slate auth config association');
    }

    let tenant = await getTenantForSlates(data.tenant);

    let slateAuthConfig = data.providerAuthConfigVersion?.slateAuthConfigOid
      ? await db.slateAuthConfig.findUniqueOrThrow({
          where: { oid: data.providerAuthConfigVersion.slateAuthConfigOid }
        })
      : null;

    let input = await messageInputToToolCall(data.input, data.message);

    let res = await slates.slateSessionToolCall.call({
      tenantId: tenant.id,
      toolId: data.tool.callableId,
      sessionId: data.slateSession!.id,
      authConfigId: slateAuthConfig?.id,

      input,

      participants: [
        {
          type: 'consumer',
          id: data.sender.id,
          name: data.sender.name,
          description: (data.sender.payload as any).description
        }
      ]
    });

    let slateToolCall = await db.slateToolCall.create({
      data: {
        oid: snowflake.nextId(),
        id: res.toolCallId,
        sessionOid: data.slateSession!.oid
      }
    });

    return {
      slateToolCall,
      output:
        res.status === 'error'
          ? { type: 'error', error: res.error }
          : { type: 'success', data: res.output }
    };
  }
}
