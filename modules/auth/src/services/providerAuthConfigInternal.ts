import { Service } from '@lowerdeck/service';
import {
  getId,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  ProviderVersion,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';

let include = {};

class providerAuthConfigInternalServiceImpl {
  async useProviderAuthConfigForDeploymentSession(d: {
    tenant: Tenant;
    provider: Provider;
    providerDeployment: ProviderDeployment;
    providerVersion: ProviderVersion;
    providerConfig: ProviderConfig;
    authConfig: ProviderAuthConfig;
  }) {
    return await withTransaction(async db => {
      await db.providerAuthConfigUsedForConfig.createMany({
        skipDuplicates: true,
        data: {
          ...getId('providerAuthConfigUsedForConfig'),
          authConfigOid: d.authConfig.oid,
          configOid: d.providerConfig.oid
        }
      });

      await db.providerAuthConfigUsedForDeployment.createMany({
        skipDuplicates: true,
        data: {
          ...getId('providerAuthConfigUsedForDeployment'),
          authConfigOid: d.authConfig.oid,
          deploymentOid: d.providerDeployment.oid
        }
      });

      return d.authConfig;
    });
  }
}

export let providerAuthConfigInternalService = Service.create(
  'providerAuthConfigInternal',
  () => new providerAuthConfigInternalServiceImpl()
).build();
