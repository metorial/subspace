import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  IdentityDelegationPermissions,
  type IdentityDelegationStatus,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { resolveIdentities, resolveIdentityActors } from '@metorial-subspace/list-utils';

let include = {
  parentDelegation: true,
  rootParentDelegation: true,
  delegationConfig: true,
  attestation: true,
  requests: {},
  parties: {},
  credentials: {}
};

class identityDelegationServiceImpl {
  async listIdentityDelegations(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: IdentityDelegationStatus[];
    permissions?: IdentityDelegationPermissions[];

    ids?: string[];
    ownerActorIds?: string[];
    delegatorActorIds?: string[];
    delegateeActorIds?: string[];
    identityIds?: string[];
  }) {
    let owners = await resolveIdentityActors(d, d.ownerActorIds);
    let delegators = await resolveIdentityActors(d, d.delegatorActorIds);
    let delegatees = await resolveIdentityActors(d, d.delegateeActorIds);
    let identities = await resolveIdentities(d, d.identityIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityDelegation.findMany({
            ...opts,

            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                d.status ? { status: { in: d.status } } : undefined!,
                d.permissions ? { permissions: { hasSome: d.permissions } } : undefined!,

                identities ? { identityOid: { in: identities.oids } } : undefined!,

                owners
                  ? {
                      parties: {
                        some: {
                          actorOid: owners.in,
                          roles: { has: 'owner' as const }
                        }
                      }
                    }
                  : undefined!,

                delegators
                  ? {
                      parties: {
                        some: {
                          actorOid: delegators.in,
                          roles: { has: 'delegator' as const }
                        }
                      }
                    }
                  : undefined!,

                delegatees
                  ? {
                      parties: {
                        some: {
                          actorOid: delegatees.in,
                          roles: { has: 'delegatee' as const }
                        }
                      }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityDelegationById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityDelegationId: string;
    allowDeleted?: boolean;
  }) {
    let identityDelegation = await db.identityDelegation.findFirst({
      where: {
        id: d.identityDelegationId,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!identityDelegation)
      throw new ServiceError(notFoundError('identity.credential', d.identityDelegationId));

    return identityDelegation;
  }
}

export let identityDelegationService = Service.create(
  'identityDelegation',
  () => new identityDelegationServiceImpl()
).build();
