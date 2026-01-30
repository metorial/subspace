import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Actor,
  CustomProviderCommit,
  CustomProviderEnvironment,
  db,
  getId,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveCustomProviderVersions,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';

let envInclude = {
  include: {
    environment: true,
    providerEnvironment: {
      include: {
        currentVersion: true
      }
    }
  }
};

let verInclude = {
  include: {
    deployment: true,
    providerVersion: true,
    customProviderEnvironmentVersions: {
      include: {
        customProviderEnvironment: {
          include: {
            environment: true,
            providerEnvironment: {
              include: {
                currentVersion: true
              }
            }
          }
        }
      }
    },
    creatorActor: true
  }
};

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  toEnvironment: envInclude,
  fromEnvironment: envInclude,
  targetCustomProviderVersion: verInclude,
  toEnvironmentVersionBefore: verInclude,
  creatorActor: true
};

class customProviderCommitServiceImpl {
  async createCustomProviderCommit(d: {
    actor: Actor;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    input: {
      message: string;

      action:
        | {
            type: 'merge_version_into_environment';
            fromEnvironment: CustomProviderEnvironment;
            toEnvironment: CustomProviderEnvironment;
          }
        | {
            type: 'rollback_commit';
            commit: CustomProviderCommit;
          };
    };
  }) {
    if (d.input.action.type === 'merge_version_into_environment') {
      checkTenant(d, d.input.action.fromEnvironment);
      checkTenant(d, d.input.action.toEnvironment);
    } else if (d.input.action.type === 'rollback_commit') {
      checkTenant(d, d.input.action.commit);
    }

    let dataBase = {
      ...getId('customProviderCommit'),

      status: 'pending' as const,
      trigger: 'manual' as const,
      type: d.input.action.type,

      message: d.input.message,

      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,

      creatorActorOid: d.actor.oid
    };

    let commit: CustomProviderCommit;

    if (d.input.action.type === 'rollback_commit') {
      let action = d.input.action;
      if (!action.commit.toEnvironmentVersionBeforeOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Initial commit cannot be rolled back.'
          })
        );
      }

      commit = await db.customProviderCommit.create({
        data: {
          ...dataBase,

          toEnvironmentOid: d.input.action.commit.toEnvironmentOid,

          // Flip the versions
          toEnvironmentVersionBeforeOid: action.commit.targetCustomProviderVersionOid,
          targetCustomProviderVersionOid: action.commit.toEnvironmentVersionBeforeOid,

          customProviderOid: action.commit.customProviderOid
        }
      });
    } else if (d.input.action.type === 'merge_version_into_environment') {
      let action = d.input.action;

      if (action.toEnvironment.oid === action.fromEnvironment.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot merge version into the same environment.'
          })
        );
      }
      if (
        action.toEnvironment.customProviderOid !== action.fromEnvironment.customProviderOid
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'From and to environments must belong to the same custom provider.'
          })
        );
      }

      let toEnvironmentFull = await db.customProviderEnvironment.findUniqueOrThrow({
        where: { oid: action.toEnvironment.oid },
        include: {
          providerEnvironment: {
            include: {
              currentVersion: {
                include: { customProviderVersion: true }
              }
            }
          }
        }
      });
      let fromEnvironmentFull = await db.customProviderEnvironment.findUniqueOrThrow({
        where: { oid: action.fromEnvironment.oid },
        include: {
          providerEnvironment: {
            include: {
              currentVersion: {
                include: { customProviderVersion: true }
              }
            }
          }
        }
      });

      let toVersion =
        toEnvironmentFull.providerEnvironment?.currentVersion?.customProviderVersion;
      let fromVersion =
        fromEnvironmentFull.providerEnvironment?.currentVersion?.customProviderVersion;

      if (!fromVersion) {
        throw new ServiceError(
          badRequestError({
            message: 'From environment has no version to merge from.'
          })
        );
      }
      if (toVersion && toVersion.oid === fromVersion.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'To environment is already at the same version as from environment.'
          })
        );
      }

      commit = await db.customProviderCommit.create({
        data: {
          ...dataBase,

          fromEnvironmentOid: action.fromEnvironment.oid,
          toEnvironmentOid: action.toEnvironment.oid,

          toEnvironmentVersionBeforeOid: toVersion ? toVersion.oid : null,
          targetCustomProviderVersionOid: fromVersion.oid,

          customProviderOid: fromVersion.customProviderOid
        }
      });
    } else {
      throw new Error('Unhandled action type');
    }

    return await db.customProviderCommit.findUniqueOrThrow({
      where: { oid: commit.oid },
      include
    });
  }

  async listCustomProviderCommits(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    ids?: string[];
    providerIds?: string[];
    customProviderIds?: string[];
    customProviderVersionIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);

    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );
    let customProviderVersions = await resolveCustomProviderVersions(
      d,
      d.customProviderVersionIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderCommit.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                customProviders ? { customProviderOid: customProviders.in } : undefined!,

                customProviderVersions
                  ? { targetCustomProviderVersionOid: customProviderVersions.in }
                  : undefined!,

                customProviderEnvironments
                  ? {
                      toEnvironmentOid: customProviderEnvironments.in,
                      fromEnvironmentOid: customProviderEnvironments.in
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getCustomProviderCommitById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderCommitId: string;
  }) {
    let customProviderCommit = await db.customProviderCommit.findFirst({
      where: {
        id: d.customProviderCommitId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!customProviderCommit)
      throw new ServiceError(
        notFoundError('custom_provider.commit', d.customProviderCommitId)
      );

    return customProviderCommit;
  }
}

export let customProviderCommitService = Service.create(
  'customProviderCommit',
  () => new customProviderCommitServiceImpl()
).build();
