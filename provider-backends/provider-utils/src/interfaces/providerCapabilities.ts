import type {
  Provider,
  ProviderDeployment,
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

  abstract getSpecificationForProviderDeployment(
    data: ProviderSpecificationGetForDeploymentParam
  ): Promise<ProviderSpecificationGetRes>;

  // If we already have the spec for the provider version, is it the same as what we'd get
  // for the deployment version?
  abstract isSpecificationForProviderDeploymentVersionSameAsForVersion(
    data: ProviderSpecificationGetForDeploymentParam
  ): Promise<boolean>;
}

export interface ProviderSpecificationGetForProviderParam {
  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export interface ProviderSpecificationGetForDeploymentParam {
  tenant: Tenant;
  deployment: (ProviderDeployment & { lockedVersion: ProviderVersion | null }) | null;

  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export interface ProviderSpecificationGetRes {
  specification: Specification;
  features: SpecificationFeatures;
  tools: SpecificationTool[];
  authMethods: SpecificationAuthMethod[];
}
