import type {
  ProviderVariant,
  ProviderVersion
} from '@metorial-subspace/db/prisma/generated/client';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderCatalog extends IProviderFunctionality {
  abstract getManyVariants(items: ProviderVariant[]): Promise<ProviderVariantResult[]>;
  abstract getManyVersions(items: ProviderVersion[]): Promise<ProviderVersionResult[]>;
}

export interface ProviderVariantResult {
  id: string;
  name: string;
}

export interface ProviderVersionResult {
  id: string;
}
