import type {
  Provider,
  ProviderAuthConfigVersion,
  ProviderConfigVersion,
  ProviderDeploymentVersion,
  ProviderVariant,
  ProviderVersion,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool
} from '../types/specification';

export abstract class IProviderCapabilities extends IProviderFunctionality {
  abstract getSpecificationForProviderVersion(
    data: ProviderSpecificationGetForProviderParam
  ): Promise<ProviderSpecificationGetRes | null>;

  abstract getSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<ProviderSpecificationGetRes>;

  abstract getSpecificationBehavior(
    data: ProviderSpecificationBehaviorParam
  ): Promise<ProviderSpecificationBehaviorRes>;
}

export interface ProviderSpecificationGetForProviderParam {
  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export interface ProviderSpecificationGetForPairParam {
  tenant: Tenant;

  deploymentVersion: ProviderDeploymentVersion | null;
  configVersion: ProviderConfigVersion;
  authConfigVersion: ProviderAuthConfigVersion | null;

  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export type ProviderSpecificationGetRes = {
  specification: Specification;
  features: SpecificationFeatures;
  tools: SpecificationTool[];
  authMethods: SpecificationAuthMethod[];
} | null;

export interface ProviderSpecificationBehaviorParam {}

export interface ProviderSpecificationBehaviorRes {
  supportsVersionSpecification: boolean;
  supportsDeploymentSpecification: boolean;
}
