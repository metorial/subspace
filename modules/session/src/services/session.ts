import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Session,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { sessionCreatedQueue, sessionUpdatedQueue } from '../queues/lifecycle/session';
import { sessionProviderInclude } from './sessionProvider';
import { SessionProviderInput, sessionProviderInputService } from './sessionProviderInput';

let include = {
  providers: {
    include: sessionProviderInclude
  }
};

class sessionServiceImpl {
  async listSessions(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.session.findMany({
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

  async getSessionById(d: { tenant: Tenant; solution: Solution; sessionId: string }) {
    let session = await db.session.findFirst({
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

  async createSession(d: {
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
      let session = await db.session.create({
        data: {
          ...getId('session'),

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        include
      });

      session.providers = await sessionProviderInputService.createProviderSessionsForInput({
        tenant: d.tenant,
        solution: d.solution,
        session,

        providers: d.input.providers
      });

      await addAfterTransactionHook(async () =>
        sessionCreatedQueue.add({ sessionId: session.id })
      );

      return session;
    });
  }

  async updateSession(d: {
    tenant: Tenant;
    solution: Solution;
    session: Session;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.session);

    return withTransaction(async db => {
      let session = await db.session.update({
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

      await addAfterTransactionHook(async () =>
        sessionUpdatedQueue.add({ sessionId: session.id })
      );

      return session;
    });
  }
}

export let sessionService = Service.create('session', () => new sessionServiceImpl()).build();
