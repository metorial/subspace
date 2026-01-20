import { delay } from '@lowerdeck/delay';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Provider,
  type ProviderDeployment,
  type ProviderVariant,
  type ProviderVersion
} from '@metorial-subspace/db';

class providerDeploymentInternalServiceImpl {
  async getCurrentVersion(d: {
    deployment: ProviderDeployment;
    provider: Provider & {
      defaultVariant?:
        | (ProviderVariant & {
            currentVersion?: ProviderVersion | null;
          })
        | null;
    };
  }) {
    return this.getCurrentVersionOptional({
      deployment: d.deployment,
      provider: d.provider
    });
  }

  async getCurrentVersionOptional(d: {
    deployment?: ProviderDeployment;
    provider: Provider & {
      defaultVariant?:
        | (ProviderVariant & {
            currentVersion?: ProviderVersion | null;
          })
        | null;
    };
  }) {
    let inner = await this.getCurrentVersionInner(d);

    if (inner.specificationDiscoveryStatus === 'discovering') {
      for (let i = 0; i < 50; i++) {
        await delay(100);
        inner = await this.getCurrentVersionInner(d);
        if (inner.specificationDiscoveryStatus !== 'discovering') break;
      }
    }

    return inner;
  }

  private async getCurrentVersionInner(d: {
    deployment?: ProviderDeployment;
    provider: Provider & {
      defaultVariant?:
        | (ProviderVariant & {
            currentVersion?: ProviderVersion | null;
          })
        | null;
    };
  }) {
    if (!d.provider.defaultVariantOid) throw new Error('Provider has no default variant oid');

    if (d.deployment?.lockedVersionOid) {
      return await db.providerVersion.findFirstOrThrow({
        where: {
          oid: d.deployment.lockedVersionOid,
          providerOid: d.provider.oid
        }
      });
    }

    let defaultVariant =
      d.provider.defaultVariant ??
      (await db.providerVariant.findFirstOrThrow({
        where: { oid: d.provider.defaultVariantOid }
      }));

    if (!defaultVariant.currentVersionOid) {
      throw new Error('Provider variant has no current version oid');
    }

    let currentVersion =
      d.provider.defaultVariant?.currentVersion ??
      (await db.providerVersion.findFirstOrThrow({
        where: { oid: defaultVariant.currentVersionOid }
      }));

    return currentVersion;
  }
}

export let providerDeploymentInternalService = Service.create(
  'providerDeploymentInternalService',
  () => new providerDeploymentInternalServiceImpl()
).build();
