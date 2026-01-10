import type {
  Provider,
  ProviderAuthCredentials,
  ProviderAuthCredentialsType,
  ProviderAuthMethod,
  ProviderOAuthSetup,
  ProviderVariant,
  ProviderVersion,
  SlateAuthConfig,
  SlateOAuthCredentials,
  SlateOAuthSetup,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderAuth extends IProviderFunctionality {
  abstract createProviderAuthCredentials(
    data: ProviderAuthCredentialsCreateParam
  ): Promise<ProviderAuthCredentialsCreateRes>;

  abstract createProviderOAuthSetup(
    data: ProviderOAuthSetupCreateParam
  ): Promise<ProviderOAuthSetupCreateRes>;

  abstract createProviderAuthConfig(
    data: ProviderAuthConfigCreateParam
  ): Promise<ProviderAuthConfigCreateRes>;

  abstract retrieveProviderOAuthSetup(
    data: ProviderOAuthSetupRetrieveParam
  ): Promise<ProviderOAuthSetupRetrieveRes>;
}

export interface ProviderAuthCredentialsCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  input: {
    type: 'oauth';
    clientId: string;
    clientSecret: string;
    scopes: string[];
  };
}

export interface ProviderAuthCredentialsCreateRes {
  slateOAuthCredentials: SlateOAuthCredentials;
  type: ProviderAuthCredentialsType;
}

export interface ProviderAuthConfigCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion: ProviderVersion;
  authMethod: ProviderAuthMethod;
  input: Record<string, any>;
}

export interface ProviderAuthConfigCreateRes {
  slateAuthConfig?: SlateAuthConfig;
}

export interface ProviderOAuthSetupCreateParam {
  tenant: Tenant;
  provider: Provider & { defaultVariant: ProviderVariant | null };
  providerVersion: ProviderVersion;
  credentials: ProviderAuthCredentials;
  authMethod: ProviderAuthMethod;
  redirectUrl: string;
  input: Record<string, any>;
}

export interface ProviderOAuthSetupCreateRes {
  slateOAuthSetup?: SlateOAuthSetup;
  url: string | null;
}

export interface ProviderOAuthSetupRetrieveParam {
  tenant: Tenant;
  setup: ProviderOAuthSetup;
}

export interface ProviderOAuthSetupRetrieveRes {
  slateOAuthSetup?: SlateOAuthSetup;
  slateAuthConfig?: SlateAuthConfig | null;

  status: 'pending' | 'completed' | 'failed';
  url: string | null;
  error: {
    code: string;
    message: string;
  } | null;
}
