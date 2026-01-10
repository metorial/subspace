import type {
  Provider,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  SlateInstance,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderDeployment extends IProviderFunctionality {
  abstract createProviderDeployment(
    data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes>;

  abstract createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes>;
}

export interface ProviderDeploymentCreateParam {
  tenant: Tenant;
  id: string;
  provider: Provider;
  providerVariant: ProviderVariant;
  lockedVersion: ProviderVersion | null;
}

export interface ProviderDeploymentCreateRes {}

export interface ProviderConfigCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerVariant: ProviderVariant;
  deployment: (ProviderDeployment & { lockedVersion: ProviderVersion | null }) | null;
  id: string;
  config: Record<string, any>;
}

export interface ProviderConfigCreateRes {
  slateInstance: SlateInstance | null;
}
