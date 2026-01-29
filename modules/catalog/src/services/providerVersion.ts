import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { resolveProviders } from '@metorial-subspace/list-utils';
import { getProviderTenantFilter } from './provider';
import { providerVariantInclude } from './providerVariant';

let include = {
  provider: true,
  providerVariant: { include: providerVariantInclude },
  slate: true,
  slateVersion: true,
  specification: true
};

class providerVersionServiceImpl {
  async listProviderVersions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerVersion.findMany({
            ...opts,
            where: {
              provider: getProviderTenantFilter(d),

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderVersionById(d: {
    providerVersionId: string;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
  }) {
    let providerVersion = await db.providerVersion.findFirst({
      where: {
        provider: getProviderTenantFilter(d),

        AND: [
          {
            OR: [{ id: d.providerVersionId }, { identifier: d.providerVersionId }]
          }
        ]
      },
      include
    });
    if (!providerVersion) {
      throw new ServiceError(notFoundError('provider.version', d.providerVersionId));
    }

    return providerVersion;
  }
}

export let providerVersionService = Service.create(
  'providerVersionService',
  () => new providerVersionServiceImpl()
).build();
