import { delay } from '@lowerdeck/delay';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  type ProviderAuthConfig,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderVersion,
  snowflake,
  withTransaction
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairCreatedQueue,
  providerDeploymentConfigPairVersionCreatedQueue
} from '../queues/lifecycle/deploymentConfigPair';

class providerDeploymentConfigPairInternalServiceImpl {
  private async upsertDeploymentConfigPairWithoutCreatingVersion(d: {
    deployment: ProviderDeployment;
    config: ProviderConfig;
    version?: ProviderVersion;
  }) {
    return withTransaction(async db => {
      let existing = await db.providerDeploymentConfigPair.findUnique({
        where: {
          providerConfigOid_providerDeploymentOid: {
            providerDeploymentOid: d.deployment.oid,
            providerConfigOid: d.config.oid
          }
        },
        include: {
          versions: d.version ? { where: { versionOid: d.version.oid } } : false
        }
      });
      if (existing) {
        return {
          pair: existing,
          version: existing.versions?.[0],
          created: false
        };
      }

      let newId = getId('providerDeploymentConfigPair');
      let pair = await db.providerDeploymentConfigPair.upsert({
        where: {
          providerConfigOid_providerDeploymentOid: {
            providerDeploymentOid: d.deployment.oid,
            providerConfigOid: d.config.oid
          }
        },
        create: {
          ...newId,
          providerDeploymentOid: d.deployment.oid,
          providerConfigOid: d.config.oid,
          tenantOid: d.deployment.tenantOid,
          environmentOid: d.deployment.environmentOid
        },
        update: {}
      });

      let created = pair.id === newId.id;

      if (created) {
        await addAfterTransactionHook(async () =>
          providerDeploymentConfigPairCreatedQueue.add({
            providerDeploymentConfigPairId: pair.id
          })
        );
      }

      let version = d.version
        ? await db.providerDeploymentConfigPairProviderVersion.findFirst({
            where: {
              pairOid: pair.oid,
              versionOid: d.version.oid
            }
          })
        : null;

      return {
        pair,
        created,
        version: version ?? undefined
      };
    });
  }

  private async upsertDeploymentConfigPairWithAuthConfig(d: {
    deployment: ProviderDeployment;
    config: ProviderConfig;
    authConfig: ProviderAuthConfig | null;
    version?: ProviderVersion;
  }) {
    return withTransaction(async db => {
      let res = await this.upsertDeploymentConfigPairWithoutCreatingVersion(d);
      if (!d.authConfig) return res;

      if (!d.authConfig.currentVersionOid) {
        throw new Error('Auth config has no current version');
      }

      let existingAuthConfigLink = await db.providerDeploymentConfigPairAuthConfig.findUnique({
        where: {
          pairOid_authConfigVersionOid: {
            pairOid: res.pair.oid,
            authConfigVersionOid: d.authConfig.currentVersionOid
          }
        }
      });
      if (existingAuthConfigLink) return res;

      await db.providerDeploymentConfigPairAuthConfig.createMany({
        data: {
          oid: snowflake.nextId(),
          pairOid: res.pair.oid,
          authConfigVersionOid: d.authConfig.currentVersionOid
        }
      });

      return res;
    });
  }

  async upsertDeploymentConfigPair(d: {
    deployment: ProviderDeployment;
    config: ProviderConfig;
    authConfig: ProviderAuthConfig | null;
    version?: ProviderVersion;
  }) {
    return withTransaction(async db => {
      let res = await this.upsertDeploymentConfigPairWithAuthConfig(d);

      if (!d.version) {
        return {
          pair: res.pair,
          version: undefined
        };
      }

      if (res.version) {
        return {
          pair: res.pair,
          version: res.version
        };
      }

      let newId = getId('providerDeploymentConfigPairProviderVersion');
      let version = await db.providerDeploymentConfigPairProviderVersion.upsert({
        where: {
          pairOid_versionOid: {
            pairOid: res.pair.oid,
            versionOid: d.version.oid
          }
        },
        create: {
          ...newId,
          pairOid: res.pair.oid,
          versionOid: d.version.oid,
          specificationDiscoveryStatus: 'discovering'
        },
        update: {}
      });

      if (version.id === newId.id) {
        await addAfterTransactionHook(async () =>
          providerDeploymentConfigPairVersionCreatedQueue.add({
            providerDeploymentConfigPairVersionId: version.id
          })
        );
      }

      return {
        pair: res.pair,
        version
      };
    });
  }

  async useDeploymentConfigPair(d: {
    deployment: ProviderDeployment;
    config: ProviderConfig;
    version: ProviderVersion;
    authConfig: ProviderAuthConfig | null;
  }) {
    let res = await this.upsertDeploymentConfigPair(d);

    // This should never happen
    if (!res.version) {
      throw new Error('Failed to create deployment config pair version');
    }

    if (res.version.specificationDiscoveryStatus === 'discovering') {
      for (let i = 1; i < 75; i++) {
        await delay(Math.min(100, 25 * i));
        res.version = await db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow({
          where: { oid: res.version.oid }
        });
        if (res.version.specificationDiscoveryStatus !== 'discovering') break;
      }
    }

    return res;
  }
}

export let providerDeploymentConfigPairInternalService = Service.create(
  'providerDeploymentConfigPairInternalService',
  () => new providerDeploymentConfigPairInternalServiceImpl()
).build();
