import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  Provider,
  ProviderConfig,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant
} from '@metorial-subspace/db';

class providerConfigSchemaServiceImpl {
  async getProviderConfigSchema(d: {
    tenant: Tenant;
    solution: Solution;

    provider?: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion?: ProviderVersion;
    providerDeployment?: ProviderDeployment;
    providerConfig?: ProviderConfig & { deployment: ProviderDeployment | null };
  }) {
    if (d.providerConfig) {
      return await db.providerSpecification.findFirstOrThrow({
        where: { oid: d.providerConfig.specificationOid },
        include: { provider: true }
      });
    }

    let versionOid =
      d.providerVersion?.oid ??
      d.providerDeployment?.lockedVersionOid ??
      d.provider?.defaultVariant?.currentVersionOid;

    if (!versionOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Unable to determine provider version for config schema'
        })
      );
    }

    let version = await db.providerVersion.findFirstOrThrow({
      where: { oid: versionOid },
      include: { specification: { include: { provider: true } } }
    });
    if (!version.specification) {
      throw new ServiceError(
        badRequestError({
          message: 'Specification not discovered for provider'
        })
      );
    }

    return version.specification;
  }
}

export let providerConfigSchemaService = Service.create(
  'providerConfigSchemaService',
  () => new providerConfigSchemaServiceImpl()
).build();
