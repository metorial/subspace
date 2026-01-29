import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  Environment,
  type Provider,
  type ProviderAuthConfig,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderSpecification,
  type ProviderVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';

class providerToolServiceImpl {
  async listProviderTools(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

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
      ? await db.providerVersion.findFirstOrThrow({
          where: { oid: versionOid }
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let listRes = await db.providerToolGlobal.findMany({
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
                  providerTools: {
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
            providerTools: version?.specificationOid
              ? {
                  where: { specificationOid: version.specificationOid },
                  include: { specification: { omit: { value: true } } }
                }
              : false
          }
        });

        return listRes
          .filter(g => g.currentInstance || g.providerTools.length)
          .map(global => {
            let inner = global.providerTools?.[0] ?? global.currentInstance!;

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

  async getProviderToolById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerToolId: string;
  }) {
    let providerTool = await db.providerTool.findFirst({
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

        id: d.providerToolId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
    if (!providerTool) {
      throw new ServiceError(notFoundError('provider_tool', d.providerToolId));
    }

    return providerTool;
  }
}

export let providerToolService = Service.create(
  'providerToolService',
  () => new providerToolServiceImpl()
).build();
