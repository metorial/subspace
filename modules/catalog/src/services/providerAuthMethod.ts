import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  ProviderVersion,
  Solution,
  Tenant
} from '@metorial-subspace/db';

class providerAuthMethodServiceImpl {
  async listProviderAuthMethods(d: {
    tenant: Tenant;
    solution: Solution;

    provider?: Provider;
    providerVersion?: ProviderVersion;
    providerDeployment?: ProviderDeployment;
    providerConfig?: ProviderConfig & { deployment: ProviderDeployment | null };
    providerAuthConfig?: ProviderAuthConfig & { deployment: ProviderDeployment | null };
  }) {
    let versionOid =
      d.providerVersion?.oid ??
      d.providerDeployment?.lockedVersionOid ??
      d.providerConfig?.deployment?.lockedVersionOid ??
      d.providerAuthConfig?.deployment?.lockedVersionOid;

    let version = versionOid
      ? await db.providerVersion.findFirst({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let listRes = await db.providerAuthMethodGlobal.findMany({
          ...opts,

          where: {
            AND: [
              {
                provider: {
                  OR: [
                    { access: 'public' as const },
                    {
                      access: 'tenant' as const,
                      ownerTenantOid: d.tenant.oid,
                      ownerSolutionOid: d.solution.oid
                    }
                  ]
                }
              }
            ],

            providerOid: d.provider?.oid,

            ...(version?.specificationOid
              ? {
                  providerAuthMethods: {
                    some: { specificationOid: version.specificationOid }
                  }
                }
              : {
                  currentInstance: { isNot: null }
                })
          },

          include: {
            provider: true,

            currentInstance: version
              ? false
              : { include: { specification: { omit: { value: true } } } },
            providerAuthMethods: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || g.providerAuthMethods.length)
          .map(global => {
            let inner = global.providerAuthMethods?.[0] ?? global.currentInstance!;

            return {
              ...inner,
              global,
              provider: global.provider,
              specification: (inner as any).specification as ProviderSpecification
            };
          });
      })
    );
  }

  async getProviderAuthMethodById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthMethodId: string;
  }) {
    let providerAuthMethod = await db.providerAuthMethod.findFirst({
      where: {
        provider: {
          OR: [
            { access: 'public' as const },
            {
              access: 'tenant' as const,
              ownerTenantOid: d.tenant.oid,
              ownerSolutionOid: d.solution.oid
            }
          ]
        },

        id: d.providerAuthMethodId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
    if (!providerAuthMethod) {
      throw new ServiceError(notFoundError('provider_tool', d.providerAuthMethodId));
    }

    return providerAuthMethod;
  }
}

export let providerAuthMethodService = Service.create(
  'providerAuthMethodService',
  () => new providerAuthMethodServiceImpl()
).build();
