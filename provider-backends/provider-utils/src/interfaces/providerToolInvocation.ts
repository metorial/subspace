import type {
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderRun,
  ProviderVariant,
  ProviderVersion,
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
}

export interface ProviderRunCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerRun: ProviderRun;

  providerVariant: ProviderVariant;
  providerConfig: ProviderConfig;
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

  slateSession?: SlateSession;

  runState: any;
  input: Record<string, any>;
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
