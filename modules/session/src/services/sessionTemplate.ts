import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  SessionProviderStatus,
  SessionTemplate,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { SessionProviderInput, sessionProviderInputService } from './sessionProviderInput';
import { sessionTemplateProviderInclude } from './sessionTemplateProvider';

let include = {
  providers: {
    include: sessionTemplateProviderInclude,
    where: { status: 'active' as const }
  }
};

class sessionTemplateServiceImpl {
  async listSessionTemplates(d: {
    tenant: Tenant;
    solution: Solution;

    status?: SessionProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveProviders(d, d.sessionProviderIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplate.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessions
                  ? { sessionProviders: { some: { sessionOid: sessions.in } } }
                  : undefined!,
                sessionProviders
                  ? { sessionProviders: { some: { providerOid: sessionProviders.in } } }
                  : undefined!,

                providers
                  ? { providers: { some: { providerOid: providers.in } } }
                  : undefined!,
                deployments
                  ? { providers: { some: { deploymentOid: deployments.in } } }
                  : undefined!,
                configs ? { providers: { some: { configOid: configs.in } } } : undefined!,
                authConfigs
                  ? { providers: { some: { authConfigOid: authConfigs.in } } }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionTemplateById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionTemplateId: string;
    allowDeleted?: boolean;
  }) {
    let session = await db.sessionTemplate.findFirst({
      where: {
        id: d.sessionTemplateId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!session)
      throw new ServiceError(notFoundError('session.template', d.sessionTemplateId));

    return session;
  }

  async createSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;

      providers: SessionProviderInput[];
    };
  }) {
    return withTransaction(async db => {
      let template = await db.sessionTemplate.create({
        data: {
          ...getId('sessionTemplate'),
          status: 'active',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        include
      });

      template.providers =
        await sessionProviderInputService.createSessionTemplateProvidersForInput({
          tenant: d.tenant,
          solution: d.solution,
          template,

          providers: d.input.providers
        });

      return template;
    });
  }

  async updateSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    template: SessionTemplate;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.template);

    return withTransaction(async db => {
      let template = await db.sessionTemplate.update({
        where: {
          oid: d.template.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        },
        include
      });

      return template;
    });
  }
}

export let sessionTemplateService = Service.create(
  'session',
  () => new sessionTemplateServiceImpl()
).build();
