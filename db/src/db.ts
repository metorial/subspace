import type { ErrorData } from '@lowerdeck/error';
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

let adapter = new PrismaPg({ connectionString: env.service.DATABASE_URL });

export let db = new PrismaClient({ adapter });

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
          type: 'v1.whitelist';
          filters: {
            type: 'tool_keys';
            keys: string[];
          }[];

          // TODO: add restrictions for resources and prompts as well
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
                  oauthCallbackUrl: string;
                }
              | { status: 'disabled' };

            export: { status: 'enabled' | 'disabled' };
            import: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled' };

      config:
        | {
            status: 'enabled';
            read: { status: 'enabled' | 'disabled' };
          }
        | { status: 'disabled' };
    };
  }
}
