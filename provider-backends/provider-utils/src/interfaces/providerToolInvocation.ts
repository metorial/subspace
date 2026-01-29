import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigVersion,
  ProviderConfigVersion,
  ProviderRun,
  ProviderVariant,
  ProviderVersion,
  Session,
  SessionConnection,
  SessionMessage,
  SessionParticipant,
  ShuttleConnection,
  SlateSession,
  SlateToolCall,
  Tenant
} from '@metorial-subspace/db';
import type { InitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderToolInvocation extends IProviderFunctionality {
  abstract createProviderRun(data: ProviderRunCreateParam): Promise<ProviderRunCreateRes>;

  abstract createToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes>;

  abstract getProviderRunLogs(data: ProviderRunLogsParam): Promise<ProviderRunLogsRes>;
}

export interface ProviderRunCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerRun: ProviderRun;

  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
  providerConfigVersion: ProviderConfigVersion;
  providerAuthConfigVersion: ProviderAuthConfigVersion | null;

  session: Session;
  connection: SessionConnection;
  participant: SessionParticipant;

  mcp: {
    clientInfo: InitializeRequest['params']['clientInfo'];
    capabilities: InitializeRequest['params']['capabilities'];
  } | null;
}

export interface ProviderRunCreateRes {
  slateSession?: SlateSession;
  shuttleConnection?: ShuttleConnection;
  runState: any;
}

export interface ToolInvocationCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerRun: ProviderRun;
  tool: { callableId: string };
  sender: SessionParticipant;
  providerAuthConfig: ProviderAuthConfig | null;
  providerAuthConfigVersion: ProviderAuthConfigVersion | null;

  slateSession?: SlateSession;
  shuttleConnection?: ShuttleConnection;

  runState: any;
  input: PrismaJson.SessionMessageInput;
  message: SessionMessage;
}

export interface ToolInvocationCreateRes {
  slateToolCall?: SlateToolCall;
  output:
    | {
        type: 'success';
        data: Record<string, any>;
      }
    | {
        type: 'error';
        error: {
          code: string;
          message: string;
        };
      };
}

export interface ProviderRunLogsParam {
  tenant: Tenant;
  providerRun: ProviderRun;
}

export interface ProviderRunLog {
  timestamp: Date;
  message: string;
  outputType: 'stdout' | 'stderr' | 'debug.info' | 'debug.warning' | 'debug.error';
}

export interface ProviderRunLogsRes {
  logs: ProviderRunLog[];
}
