import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigVersion,
  ProviderConfig,
  ProviderConfigVersion,
  ProviderRun,
  ProviderVariant,
  ProviderVersion,
  SessionMessage,
  SessionParticipant,
  SlateSession,
  SlateToolCall,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderToolInvocation extends IProviderFunctionality {
  abstract createProviderRun(data: ProviderRunCreateParam): Promise<ProviderRunCreateRes>;

  abstract createToolInvocation(
    data: ToolInvocationCreateParam
  ): Promise<ToolInvocationCreateRes>;

  abstract getToolInvocationLogs(
    data: ToolInvocationLogsParam
  ): Promise<ToolInvocationLogsRes>;
}

export interface ProviderRunCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerRun: ProviderRun;

  providerVariant: ProviderVariant;
  providerConfig: ProviderConfig;
  providerConfigVersion: ProviderConfigVersion;
  providerVersion: ProviderVersion;
}

export interface ProviderRunCreateRes {
  slateSession?: SlateSession;
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

export interface ToolInvocationLogsParam {
  tenant: Tenant;
  slateToolCallId: string;
}

export interface ToolInvocationLog {
  timestamp: number;
  message: string;
}

export interface ToolInvocationLogsRes {
  logs: ToolInvocationLog[];
}
