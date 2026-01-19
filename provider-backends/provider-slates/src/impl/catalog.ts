import { db } from '@metorial-subspace/db';
import type {
  ProviderVariant,
  ProviderVersion
} from '@metorial-subspace/db/prisma/generated/client';
import {
  IProviderCatalog,
  type ProviderVariantResult,
  type ProviderVersionResult
} from '@metorial-subspace/provider-utils';
import { slates } from '../client';

export class ProviderCatalog extends IProviderCatalog {
  override async getManyVariants(items: ProviderVariant[]): Promise<ProviderVariantResult[]> {
    let slateIds = await db.slate.findMany({
      where: {
        providerVariants: {
          some: {
            oid: { in: items.map(item => item.oid) }
          }
        }
      },
      select: { id: true }
    });

    return await slates.slate.getMany({
      slateIds: slateIds.map(slate => slate.id)
    });
  }

  override async getManyVersions(items: ProviderVersion[]): Promise<ProviderVersionResult[]> {
    let slateVersionIds = await db.slateVersion.findMany({
      where: {
        providerVersions: {
          some: {
            oid: { in: items.map(item => item.oid) }
          }
        }
      },
      select: { id: true }
    });

    return await slates.slateVersion.getMany({
      slateVersionIds: slateVersionIds.map(slate => slate.id)
    });
  }
}
