import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, SessionErrorType, Solution, Tenant } from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderRuns,
  resolveProviders,
  resolveSessionConnections,
  resolveSessionErrorGroups,
  resolveSessionMessages,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';

let include = {
  session: true,
  providerRun: true,
  message: true,
  connection: true,
  error: true
};

class sessionErrorServiceImpl {
  async listSessionErrors(d: {
    tenant: Tenant;
    solution: Solution;

    types?: SessionErrorType[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerRunIds?: string[];
    providerIds?: string[];
    sessionMessageIds?: string[];
    sessionErrorGroupIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(d, d.providerRunIds);
    let messages = await resolveSessionMessages(d, d.sessionMessageIds);
    let groups = await resolveSessionErrorGroups(d, d.sessionErrorGroupIds);
    let providers = await resolveProviders(d, d.providerIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionError.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                  : undefined!,
                connections ? { connectionOid: connections.in } : undefined!,
                providerRuns ? { providerRunOid: providerRuns.in } : undefined!,
                groups ? { errorGroupOid: groups.in } : undefined!,
                messages ? { sessionMessages: { some: { oid: messages.in } } } : undefined!,
                providers ? { providerRun: { providerOid: providers.in } } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionErrorById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionErrorId: string;
    allowDeleted?: boolean;
  }) {
    let sessionError = await db.sessionError.findFirst({
      where: {
        id: d.sessionErrorId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!sessionError)
      throw new ServiceError(notFoundError('session.event', d.sessionErrorId));

    return sessionError;
  }
}

export let sessionErrorService = Service.create(
  'sessionError',
  () => new sessionErrorServiceImpl()
).build();
