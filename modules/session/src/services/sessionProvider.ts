import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Session, SessionProvider, Solution, Tenant } from '@metorial-subspace/db';
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
export let sessionProviderInclude = include;

class sessionProviderServiceImpl {
  async listSessionProviders(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionProvider.findMany({
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

  async getSessionProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionProviderId: string;
  }) {
    let sessionProvider = await db.sessionProvider.findFirst({
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

  async createSessionProvider(d: {
    tenant: Tenant;
    solution: Solution;

    session: Session;
    input: SessionProviderInput;
  }) {
    let [res] = await sessionProviderInputService.createProviderSessionsForInput({
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
        toolFilter: await sessionProviderInputService.mapToolFilters({
          filters: d.input.toolFilters
        })
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
