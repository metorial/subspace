import { getBackend } from '@metorial-subspace/provider';
import type { ToolInvocationCreateParam } from '@metorial-subspace/provider-utils';
import type { ConnectionState } from '.';

export let getConnectionBackendConnection = async (state: ConnectionState) => {
  let backend = await getBackend({ entity: state.version });
  let run = await backend.providerRun.createProviderRun({
    tenant: state.instance.sessionProvider.tenant,
    providerConfigVersion: state.instance.sessionProvider.config.currentVersion!,
    providerAuthConfigVersion:
      state.instance.sessionProvider.authConfig?.currentVersion ?? null,

    session: state.session,
    connection: state.connection,
    participant: state.participant,

    providerVersion: state.version,
    provider: state.version.provider,
    providerVariant: state.version.providerVariant,

    providerRun: state.providerRun,

    mcp:
      state.connection.mcpData.capabilities && state.connection.mcpData.clientInfo
        ? {
            capabilities: state.connection.mcpData.capabilities,
            clientInfo: state.connection.mcpData.clientInfo
          }
        : null
  });

  let conn = run.connection;

  return {
    close: async () => {
      await conn.close();
    },

    send: async (d: ToolInvocationCreateParam) => {
      return await conn.handleToolInvocation(d);
    },

    onMessage: (
      listener: (data: { output: PrismaJson.SessionMessageOutput }) => Promise<void>
    ) => {
      conn.onMessage(listener);
    },

    onClose: (listener: () => Promise<void>) => {
      conn.onClose(listener);
    }
  };
};
