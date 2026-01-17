import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  SessionTemplate,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { sessionProviderInclude } from './sessionProvider';
import { SessionProviderInput, sessionProviderInputService } from './sessionProviderInput';

let include = {
  providers: {
    include: sessionProviderInclude,
    where: { status: 'active' as const }
  }
};

class sessionTemplateServiceImpl {
  async listSessionTemplates(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplate.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid
            },
            include
          })
      )
    );
  }

  async getSessionTemplateById(d: { tenant: Tenant; solution: Solution; sessionId: string }) {
    let session = await db.sessionTemplate.findFirst({
      where: {
        id: d.sessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionId));

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
    session: SessionTemplate;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.session);

    return withTransaction(async db => {
      let session = await db.sessionTemplate.update({
        where: {
          oid: d.session.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.session.name,
          description: d.input.description ?? d.session.description,
          metadata: d.input.metadata ?? d.session.metadata
        },
        include
      });

      return session;
    });
  }
}

export let sessionTemplateService = Service.create(
  'session',
  () => new sessionTemplateServiceImpl()
).build();
