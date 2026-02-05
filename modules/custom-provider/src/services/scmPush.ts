import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Environment, Solution, type Tenant } from '@metorial-subspace/db';
import { resolveScmRepos } from '@metorial-subspace/list-utils';

let include = { repo: true };

class scmPushServiceImpl {
  async listScmRepositories(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    scmRepoIds?: string[];
  }) {
    let repos = await resolveScmRepos(d, d.scmRepoIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.scmRepoPush.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                repos ? { repoOid: repos.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getScmPushById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    scmPushId: string;
  }) {
    let scmRepoPush = await db.scmRepoPush.findFirst({
      where: {
        id: d.scmPushId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!scmRepoPush) throw new ServiceError(notFoundError('scm.repository', d.scmPushId));

    return scmRepoPush;
  }
}

export let scmPushService = Service.create('scmPush', () => new scmPushServiceImpl()).build();
