import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  SessionTemplate,
  SessionTemplateProvider,
  Solution,
  Tenant
} from '@metorial-subspace/db';
import {
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
  authConfig: true
};

class sessionTemplateProviderServiceImpl {
  async listSessionTemplateProviders(d: {
    tenant: Tenant;
    solution: Solution;

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
    sessionProviderId: string;
  }) {
    let sessionProvider = await db.sessionTemplateProvider.findFirst({
      where: {
        id: d.sessionProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(notFoundError('sessionProvider', d.sessionProviderId));

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
    sessionProvider: SessionTemplateProvider;
    input: {
      toolFilters?: SessionProviderInputToolFilters;
    };
  }) {
    checkTenant(d, d.sessionProvider);

    return await db.sessionTemplateProvider.update({
      where: {
        oid: d.sessionProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      data: {
        toolFilter: await sessionProviderInputService.mapToolFilters({
          filters: d.input.toolFilters
        })
      },
      include
    });
  }

  async deleteSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    sessionProvider: SessionTemplateProvider;
  }) {
    checkTenant(d, d.sessionProvider);

    await db.sessionTemplateProvider.update({
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

export let sessionTemplateProviderService = Service.create(
  'sessionProvider',
  () => new sessionTemplateProviderServiceImpl()
).build();
