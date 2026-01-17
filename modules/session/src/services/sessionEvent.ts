import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, SessionEventType, Solution, Tenant } from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderRuns,
  resolveSessionConnections,
  resolveSessionErrors,
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

class sessionEventServiceImpl {
  async listSessionEvents(d: {
    tenant: Tenant;
    solution: Solution;

    types?: SessionEventType[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerRunIds?: string[];
    sessionMessageIds?: string[];
    sessionErrorIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(d, d.providerRunIds);
    let messages = await resolveSessionMessages(d, d.sessionMessageIds);
    let errors = await resolveSessionErrors(d, d.sessionErrorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionEvent.findMany({
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
                messages ? { messageOid: messages.in } : undefined!,
                errors ? { errorOid: errors.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionEventById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionEventId: string;
    allowDeleted?: boolean;
  }) {
    let sessionEvent = await db.sessionEvent.findFirst({
      where: {
        id: d.sessionEventId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!sessionEvent)
      throw new ServiceError(notFoundError('session.event', d.sessionEventId));

    return sessionEvent;
  }
}

export let sessionEventService = Service.create(
  'sessionEvent',
  () => new sessionEventServiceImpl()
).build();
