import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
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
    deployment: ProviderDeployment;
    provider: Provider & {
      defaultVariant?:
        | (ProviderVariant & {
            currentVersion?: ProviderVersion | null;
          })
        | null;
    };
  }) {
    let inner = await this.getCurrentVersionInner(d);
    if (!inner) return null;

    if (inner.specificationDiscoveryStatus === 'discovering') {
      for (let i = 0; i < 50; i++) {
        await delay(100);
        inner = await this.getCurrentVersionInner(d);
        if (inner!.specificationDiscoveryStatus !== 'discovering') break;
      }
    }

    return inner;
  }

  private async getCurrentVersionInner(d: {
    deployment: ProviderDeployment;
    provider: Provider & {
      defaultVariant?:
        | (ProviderVariant & {
            currentVersion?: ProviderVersion | null;
          })
        | null;
    };
  }) {
    if (!d.provider.defaultVariantOid) return null;

    if (d.deployment?.lockedVersionOid) {
      return await db.providerVersion.findFirstOrThrow({
        where: {
          oid: d.deployment.lockedVersionOid,
          providerOid: d.provider.oid
        }
      });
    }

    if (d.provider.hasEnvironments) {
      let env = await db.providerEnvironment.findUnique({
        where: {
          environmentOid_providerOid: {
            environmentOid: d.deployment.environmentOid,
            providerOid: d.provider.oid
          }
        },
        include: { currentVersion: true }
      });
      if (env?.currentVersion) {
        return env.currentVersion;
      }

      // Check if we have a version for another environment
      let version = await db.providerVersion.findFirst({
        where: {
          providerOid: d.provider.oid,
          providerEnvironmentVersions: {
            some: {}
          }
        }
      });
      if (version) {
        throw new ServiceError(
          badRequestError({
            message:
              'Provider has deployed versions in other environments, but not in the current one.'
          })
        );
      }

      return null;
    }

    let defaultVariant =
      d.provider.defaultVariant ??
      (await db.providerVariant.findFirstOrThrow({
        where: { oid: d.provider.defaultVariantOid }
      }));
    if (!defaultVariant.currentVersionOid) {
      return null;
    }

    if (d.provider.defaultVariant?.currentVersion) {
      return d.provider.defaultVariant.currentVersion;
    }

    return await db.providerVersion.findFirstOrThrow({
      where: { oid: defaultVariant.currentVersionOid }
    });
  }
}

export let providerDeploymentInternalService = Service.create(
  'providerDeploymentInternalService',
  () => new providerDeploymentInternalServiceImpl()
).build();
