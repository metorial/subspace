import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type IdentityDelegationRequestStatus,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { resolveIdentities, resolveIdentityActors } from '@metorial-subspace/list-utils';
import { delegationInclude } from './identityDelegation';

let include = {
  delegation: { include: delegationInclude },
  requester: true,
  identity: true
};

class identityDelegationRequestServiceImpl {
  async listIdentityDelegationRequests(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: IdentityDelegationRequestStatus[];

    ids?: string[];
    actorIds?: string[];
    identityIds?: string[];
  }) {
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegationRequest.findMany({
            ...opts,

            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.status ? { status: { in: d.status } } : undefined!,

                identities ? { identityOid: identities.in } : undefined!,
                actors ? { requesterOid: actors.in } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityDelegationRequestById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityDelegationId: string;
    allowDeleted?: boolean;
  }) {
    let identityDelegationRequest = await db.identityDelegationRequest.findFirst({
      where: {
        id: d.identityDelegationId,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!identityDelegationRequest)
      throw new ServiceError(
        notFoundError('identity.delegation_request', d.identityDelegationId)
      );

    return identityDelegationRequest;
  }
}

export let identityDelegationRequestService = Service.create(
  'identityDelegationRequest',
  () => new identityDelegationRequestServiceImpl()
).build();
