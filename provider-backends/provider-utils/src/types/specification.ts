import type { InitializeResult } from '@modelcontextprotocol/sdk/types.js';

export type SpecificationAuthMethodType = 'oauth' | 'token' | 'service_account' | 'custom';

export interface SpecificationTool {
  specId: string;
  specUniqueIdentifier: string;
  callableId: string;

  key: string;

  name: string;
  description?: string;

  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;

  constraints: string[];
  instructions: string[];

  mcpToolType:
    | {
        type: 'tool.callable';
      }
    | {
        type: 'mcp.tool';
        key: string;
      }
    | {
        type: 'mcp.prompt';
        key: string;
        arguments: {
          name: string;
          description?: string | undefined;
          required?: boolean | undefined;
        }[];
      }
    | {
        type: 'mcp.resource_template';
        uriTemplate: string;
        variableNames: string[];
      };

  capabilities: {
    [key: string]: any;
  };

  tags?: {
    destructive?: boolean | undefined;
    readOnly?: boolean | undefined;
  };

  metadata: Record<string, any>;
}

export interface SpecificationAuthMethod {
  specId: string;
  specUniqueIdentifier: string;
  callableId: string;

  type: SpecificationAuthMethodType;

  key: string;

  name: string;
  description?: string;

  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;

  capabilities: {
    [key: string]: any;
  };

  scopes?: {
    id: string;
    title: string;
    description?: string;
  }[];

  metadata: Record<string, any>;
}

export interface Specification {
  specId: string;
  specUniqueIdentifier: string;

  key: string;

  name: string;
  description?: string;

  configJsonSchema: Record<string, any>;
  configVisibility: 'encrypted' | 'plain';

  metadata: Record<string, any>;

  mcp: {
    serverInfo: InitializeResult['serverInfo'];
    capabilities: InitializeResult['capabilities'];
    instructions: InitializeResult['instructions'];
  } | null;
}

export interface SpecificationFeatures {
  supportsAuthMethod: boolean;
  configContainsAuth: boolean;
}
