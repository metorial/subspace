import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  SessionTemplate,
  SessionTemplateProvider,
  SessionTemplateProviderStatus,
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
  sessionTemplate: true
};
export let sessionTemplateProviderInclude = include;

class sessionTemplateProviderServiceImpl {
  async listSessionTemplateProviders(d: {
    tenant: Tenant;
    solution: Solution;

    status?: SessionTemplateProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionTemplateIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
  }) {
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplateProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                sessionTemplates ? { sessionTemplateOid: sessionTemplates.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!
              ]
            },
            include
          })
      )
    );
  }

  async getSessionTemplateProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionTemplateProviderId: string;
    allowDeleted?: boolean;
  }) {
    let sessionProvider = await db.sessionTemplateProvider.findFirst({
      where: {
        id: d.sessionTemplateProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(
        notFoundError('session.template.provider', d.sessionTemplateProviderId)
      );

    return sessionProvider;
  }

  async createSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;

    template: SessionTemplate;
    input: SessionProviderInput;
  }) {
    let [res] = await sessionProviderInputService.createSessionTemplateProvidersForInput({
      tenant: d.tenant,
      solution: d.solution,

      template: d.template,
      providers: [d.input]
    });

    return res!;
  }

  async updateSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    sessionTemplateProvider: SessionTemplateProvider;
    input: {
      toolFilters?: SessionProviderInputToolFilters;
    };
  }) {
    checkTenant(d, d.sessionTemplateProvider);

    return await db.sessionTemplateProvider.update({
      where: {
        oid: d.sessionTemplateProvider.oid,
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

  async deleteSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    sessionTemplateProvider: SessionTemplateProvider;
  }) {
    checkTenant(d, d.sessionTemplateProvider);

    await db.sessionTemplateProvider.update({
      where: {
        oid: d.sessionTemplateProvider.oid
      },
      data: {
        status: 'inactive' as const
      },
      include
    });
  }
}

export let sessionTemplateProviderService = Service.create(
  'sessionProvider',
  () => new sessionTemplateProviderServiceImpl()
).build();
