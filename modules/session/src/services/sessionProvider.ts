import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  Session,
  SessionProvider,
  SessionProviderStatus,
  Solution,
  Tenant
} from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessions,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  SessionProviderInput,
  sessionProviderInputService,
  SessionProviderInputToolFilters
} from './sessionProviderInput';

let include = {
  provider: true,
  deployment: true,
  config: true,
  authConfig: true,
  session: true,
  fromTemplate: true,
  fromTemplateProvider: true
};
export let sessionProviderInclude = include;

class sessionProviderServiceImpl {
  async listSessionProviders(d: {
    tenant: Tenant;
    solution: Solution;

    status?: SessionProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionTemplateIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionTemplates ? { fromTemplateOid: sessionTemplates.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionProviderId: string;

    allowDeleted?: boolean;
  }) {
    let sessionProvider = await db.sessionProvider.findFirst({
      where: {
        id: d.sessionProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(notFoundError('sessionProvider', d.sessionProviderId));

    return sessionProvider;
  }

  async createSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;

    session: Session;
    input: SessionProviderInput;
  }) {
    let [res] = await sessionProviderInputService.createSessionProvidersForInput({
      tenant: d.tenant,
      solution: d.solution,

      session: d.session,
      providers: [d.input]
    });

    return res!;
  }

  async updateSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;
    sessionProvider: SessionProvider;
    input: {
      toolFilters?: SessionProviderInputToolFilters;
    };
  }) {
    checkTenant(d, d.sessionProvider);

    return await db.sessionProvider.update({
      where: {
        oid: d.sessionProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      data: {
        toolFilter:
          d.input.toolFilters !== undefined
            ? await sessionProviderInputService.mapToolFilters({
                filters: d.input.toolFilters
              })
            : undefined
      },
      include
    });
  }

  async deleteSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;
    sessionProvider: SessionProvider;
  }) {
    checkTenant(d, d.sessionProvider);

    await db.sessionProvider.update({
      where: {
        oid: d.sessionProvider.oid
      },
      data: {
        status: 'inactive' as const
      },
      include
    });
  }
}

export let sessionProviderService = Service.create(
  'sessionProvider',
  () => new sessionProviderServiceImpl()
).build();
