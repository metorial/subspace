import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, SessionConnectionStatus, Solution, Tenant } from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveSessionParticipants,
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

class sessionConnectionServiceImpl {
  async listSessionConnections(d: {
    tenant: Tenant;
    solution: Solution;

    status?: SessionConnectionStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    participantIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let participants = await resolveSessionParticipants(d, d.participantIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionConnection.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRuns: { some: { sessionProviderOid: sessionProviders.in } } }
                  : undefined!,
                participants ? { participantOid: participants.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionConnectionById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionConnectionId: string;
    allowDeleted?: boolean;
  }) {
    let sessionConnection = await db.sessionConnection.findFirst({
      where: {
        id: d.sessionConnectionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!sessionConnection)
      throw new ServiceError(notFoundError('session.connection', d.sessionConnectionId));

    return sessionConnection;
  }
}

export let sessionConnectionService = Service.create(
  'sessionConnection',
  () => new sessionConnectionServiceImpl()
).build();
