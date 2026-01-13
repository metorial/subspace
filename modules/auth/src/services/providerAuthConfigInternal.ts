import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  Provider,
  ProviderAuthConfig,
  ProviderAuthMethodType,
  ProviderConfig,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';

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
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.providerConfig);
    checkTenant(d, d.authConfig);

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

  async getVersionAndAuthMethod(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      lockedVersion: ProviderVersion | null;
    };
    authMethodId?: string | bigint;
  }) {
    let version = await providerDeploymentInternalService.getCurrentVersionOptional({
      provider: d.provider,
      deployment: d.providerDeployment
    });
    if (!version.specificationOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider has not been discovered'
        })
      );
    }

    if (!d.authMethodId) {
      let authMethod = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: version.specificationOid,
          isDefault: true
        }
      });
      if (!authMethod) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider does not support authentication'
          })
        );
      }

      return { version, authMethod };
    }

    let authMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: version.specificationOid,

        ...(typeof d.authMethodId == 'string'
          ? {
              OR: [
                { id: d.authMethodId },
                { specId: d.authMethodId },
                { specUniqueIdentifier: d.authMethodId },
                { key: d.authMethodId },
                { callableId: d.authMethodId },

                ...(ProviderAuthMethodType[
                  d.authMethodId as keyof typeof ProviderAuthMethodType
                ]
                  ? [{ type: d.authMethodId as any }]
                  : [])
              ]
            }
          : { oid: d.authMethodId })
      }
    });
    if (!authMethod) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid auth method for provider',
          code: 'invalid_auth_method'
        })
      );
    }

    return { version, authMethod };
  }
}

export let providerAuthConfigInternalService = Service.create(
  'providerAuthConfigInternal',
  () => new providerAuthConfigInternalServiceImpl()
).build();
