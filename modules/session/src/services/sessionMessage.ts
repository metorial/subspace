import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type SessionMessageType,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderRuns,
  resolveSessionConnections,
  resolveSessionErrors,
  resolveSessionParticipants,
  resolveSessionProviders,
  resolveSessions
} from '@metorial-subspace/list-utils';
import { sessionErrorInclude } from './sessionError';

let include = {
  session: true,
  sessionProvider: true,
  senderParticipant: { include: { provider: true } },
  responderParticipant: { include: { provider: true } },
  connection: true,
  providerRun: true,
  toolCall: {
    include: {
      tool: {
        include: {
          provider: true,
          specification: { omit: { value: true } }
        }
      }
    }
  },
  error: { include: sessionErrorInclude }
};
export let sessionMessageInclude = include;

class sessionMessageServiceImpl {
  async listSessionMessages(d: {
    tenant: Tenant;
    solution: Solution;

    types?: SessionMessageType[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionIds?: string[];
    sessionProviderIds?: string[];
    sessionConnectionIds?: string[];
    providerRunIds?: string[];
    errorIds?: string[];
    participantIds?: string[];
  }) {
    let sessions = await resolveSessions(d, d.sessionIds);
    let sessionProviders = await resolveSessionProviders(d, d.sessionProviderIds);
    let connections = await resolveSessionConnections(d, d.sessionConnectionIds);
    let providerRuns = await resolveProviderRuns(d, d.providerRunIds);
    let errors = await resolveSessionErrors(d, d.errorIds);
    let participants = await resolveSessionParticipants(d, d.participantIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionMessage.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                normalizeStatusForList(d).onlyParent,
                { status: { not: 'waiting_for_response' as const } },

                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,

                sessions ? { sessionOid: sessions.in } : undefined!,
                sessionProviders
                  ? { providerRun: { sessionProviderOid: sessionProviders.in } }
                  : undefined!,
                connections ? { connectionOid: connections.in } : undefined!,
                providerRuns ? { providerRunOid: providerRuns.in } : undefined!,
                errors ? { errorOid: errors.in } : undefined!,
                participants
                  ? {
                      OR: [
                        { senderParticipantOid: participants.in },
                        { responderParticipantOid: participants.in }
                      ]
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionMessageById(d: {
    tenant: Tenant;
    solution: Solution;
    sessionMessageId: string;
    allowDeleted?: boolean;
  }) {
    let sessionMessage = await db.sessionMessage.findFirst({
      where: {
        id: d.sessionMessageId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,

        AND: [normalizeStatusForGet(d).onlyParent, { status: { not: 'waiting_for_response' } }]
      },
      include
    });
    if (!sessionMessage)
      throw new ServiceError(notFoundError('session.message', d.sessionMessageId));

    return sessionMessage;
  }
}

export let sessionMessageService = Service.create(
  'sessionMessage',
  () => new sessionMessageServiceImpl()
).build();
