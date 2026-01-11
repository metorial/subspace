import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Provider, ProviderVariant } from '@metorial-subspace/db';
import { providerVariantInclude } from './providerVariant';

let include = {
  provider: true,
  providerVariant: { include: providerVariantInclude },
  slate: true,
  slateVersion: true
};

class providerVersionServiceImpl {
  async getProviderVersionById(d: { providerVersionId: string; provider: Provider }) {
    let providerVersion = await db.providerVersion.findFirst({
      where: {
        providerOid: d.provider.oid,
        OR: [{ id: d.providerVersionId }, { identifier: d.providerVersionId }]
      },
      include
    });
    if (!providerVersion) {
      throw new ServiceError(notFoundError('provider_version', d.providerVersionId));
    }

    return providerVersion;
  }

  async listProviderVersions(d: { provider: Provider; variant?: ProviderVariant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVersion.findMany({
            ...opts,
            where: {
              providerOid: d.provider.oid,
              providerVariantOid: d.variant?.oid
            },
            include
          })
      )
    );
  }
}

export let providerVersionService = Service.create(
  'providerVersionService',
  () => new providerVersionServiceImpl()
).build();
