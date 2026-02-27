import type { ErrorData } from '@lowerdeck/error';
import { withExecutionContextTraceFallback } from '@lowerdeck/telemetry';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool
} from '@metorial-subspace/provider-utils';
import type { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { env } from './env';
import type { CustomProviderConfig, CustomProviderFrom } from './types';

let adapter = new PrismaPg({ connectionString: env.service.DATABASE_URL });

let baseDb = new PrismaClient({ adapter });

export let db = baseDb.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        return await withExecutionContextTraceFallback(async () => await query(args));
      }
    }
  }
});

declare global {
  namespace PrismaJson {
    type EntityImage =
      | { type: 'file'; fileId: string; fileLinkId: string; url: string }
      | { type: 'enterprise_file'; fileId: string }
      | { type: 'url'; url: string }
      | { type: 'default' };

    type PublisherSource = { type: 'github'; url: string; owner: string; repo?: string };

    type ProviderSpecificationValue = {
      specification: Specification;
      authMethods: SpecificationAuthMethod[];
      features: SpecificationFeatures;
      tools: SpecificationTool[];
    };

    type ProviderAuthMethodValue = SpecificationAuthMethod;

    type ProviderToolValue = SpecificationTool;

    type ToolFilter =
      | {
          type: 'v1.allow_all';
        }
      | {
          type: 'v1.filter';
          filters: (
            | {
                type: 'tool_keys';
                keys: string[];
              }
            | {
                type: 'tool_regex';
                pattern: string;
              }
            | {
                type: 'resource_regex';
                pattern: string;
              }
            | {
                type: 'resource_uris';
                uris: string[];
              }
            | {
                type: 'prompt_keys';
                keys: string[];
              }
            | {
                type: 'prompt_regex';
                pattern: string;
              }
          )[];
        };

    type SessionConnectionMcpData = {
      capabilities?: InitializeRequest['params']['capabilities'];
      protocolVersion?: InitializeRequest['params']['protocolVersion'];
      clientInfo?: InitializeRequest['params']['clientInfo'];
    };

    type SessionMessageOutput =
      | { type: 'tool.result'; data: any }
      | {
          type: 'error';
          data: ErrorData<any, any> | { code: number | string; message: string };
        }
      | { type: 'mcp'; data: JSONRPCMessage };

    type SessionMessageInput =
      | { type: 'tool.call'; data: any }
      | { type: 'mcp'; data: JSONRPCMessage };

    type SessionMessageClientMcpId = string | number | null;

    type SessionParticipantPayload = {
      identifier: string;
      name: string;
      [key: string]: any;
    };

    type CustomProviderPayload = {
      from: CustomProviderFrom;
      config: CustomProviderConfig | undefined;
    };

    type ProviderTypeAttributes = {
      provider: 'metorial-slates' | 'metorial-shuttle';
      backend: 'slates' | 'mcp.container' | 'mcp.function' | 'mcp.remote';

      triggers:
        | {
            status: 'enabled';
            receiverUrl: string;
          }
        | { status: 'disabled' };

      auth:
        | {
            status: 'enabled';

            oauth:
              | {
                  status: 'enabled';
                  oauthAutoRegistration?: { status: 'supported' | 'unsupported' };
                  oauthCallbackUrl: string;
                }
              | { status: 'disabled'; oauthAutoRegistration?: undefined };

            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled'; oauth?: undefined; export?: undefined; import?: undefined };

      config:
        | {
            status: 'enabled';
            read: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled'; read?: undefined };
    };

    type ProviderDeploymentConfigPairDiscoveryError =
      | {
          type: 'mcp_error';
          error: {
            code: number;
            message: string;
            data?: any;
          };
        }
      | {
          type: 'connection_error';
          error: {
            code: string;
            message?: string;
          };
        }
      | {
          type: 'timeout_error';
          message?: string;
        }
      | null;

    type ProviderDeploymentConfigPairDiscoveryWarning = {
      code: string;
      message: string;
      data?: any;
    };
  }
}
