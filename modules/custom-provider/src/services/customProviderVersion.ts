import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { CustomProviderConfig, CustomProviderFrom } from '@metorial-subspace/db';
import {
  addAfterTransactionHook,
  db,
  getId,
  withTransaction,
  type Actor,
  type CustomProvider,
  type CustomProviderVersionStatus,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  resolveCustomProviderDeployments,
  resolveCustomProviderEnvironments,
  resolveCustomProviders,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { prepareVersion } from '../internal/createVersion';
import { handleUpcomingCustomProviderQueue } from '../queues/upcoming/handle';

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  deployment: {
    include: {
      commit: true,
      scmRepoPush: { include: { repo: true } }
    }
  },
  providerVersion: true,
  immutableCodeBucket: { include: { scmRepo: true } },
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
};

class customProviderVersionServiceImpl {
  async createCustomProviderVersion(d: {
    actor: Actor;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    customProvider: CustomProvider;
    input: {
      message?: string;
      from?: CustomProviderFrom;
      config?: CustomProviderConfig;
    };
  }) {
    checkTenant(d, d.customProvider);
    checkDeletedRelation(d.customProvider);

    let from = d.input.from || d.customProvider.payload.from;
    let config = d.input.config || d.customProvider.payload.config;

    if (d.customProvider.type !== from.type) {
      throw new ServiceError(
        badRequestError({
          message: `Custom provider type '${d.customProvider.type}' does not match deployment from type '${from.type}'`,
          hint: 'Please ensure the deployment from type matches the custom provider type.'
        })
      );
    }

    if (from.type === 'function' && from.files && from.repository) {
      throw new ServiceError(
        badRequestError({
          message:
            'Cannot create deployment from files when SCM repo is set on custom provider',
          hint: 'Unlink the SCM repo from the custom provider or remove the files from the deployment input.'
        })
      );
    }

    if (from.type === 'function' && !from.files?.length && !from.repository) {
      throw new ServiceError(
        badRequestError({
          message:
            'No deployment source provided. Either files or an SCM repository must be set to create a deployment.',
          hint: 'Please provide either deployment files or link an SCM repository.'
        })
      );
    }

    return withTransaction(async db => {
      await db.customProvider.updateMany({
        where: { oid: d.customProvider.oid },
        data: {
          payload: {
            // @ts-ignore - strip files
            from: { ...from, files: undefined },
            config
          }
        }
      });

      let versionPrep = await prepareVersion({
        actor: d.actor,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        customProvider: d.customProvider,
        trigger: 'manual'
      });

      let upcoming = await db.upcomingCustomProvider.create({
        data: {
          ...getId('upcomingCustomProvider'),
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          actorOid: d.actor.oid,

          message: d.input.message,

          type: 'create_custom_provider',

          customProviderOid: d.customProvider.oid,
          customProviderVersionOid: versionPrep.version.oid,
          customProviderDeploymentOid: versionPrep.deployment.oid,

          payload: {
            from,
            config
          }
        }
      });

      await addAfterTransactionHook(async () =>
        handleUpcomingCustomProviderQueue.add({ upcomingCustomProviderId: upcoming.id })
      );

      return await db.customProviderVersion.findUniqueOrThrow({
        where: { oid: versionPrep.version.oid, tenantOid: d.tenant.oid },
        include
      });
    });
  }

  async listCustomProviderVersions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: CustomProviderVersionStatus[];

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    customProviderIds?: string[];
    customProviderDeploymentIds?: string[];
    customProviderEnvironmentIds?: string[];
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let providerVersions = await resolveProviders(d, d.providerVersionIds);
    let customProviders = await resolveCustomProviders(d, d.customProviderIds);
    let customProviderDeployments = await resolveCustomProviderDeployments(
      d,
      d.customProviderDeploymentIds
    );
    let customProviderEnvironments = await resolveCustomProviderEnvironments(
      d,
      d.customProviderEnvironmentIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customProviderVersion.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                d.status ? { status: { in: d.status } } : undefined!,

                providers ? { customProvider: { providerOid: providers.in } } : undefined!,
                providerVersions ? { providerVersionOid: providerVersions.in } : undefined!,

                customProviders ? { customProviderOid: customProviders.in } : undefined!,
                customProviderDeployments
                  ? { deploymentOid: customProviderDeployments.in }
                  : undefined!,
                customProviderEnvironments
                  ? {
                      customProviderEnvironmentVersions: {
                        some: { customProviderEnvironmentOid: customProviderEnvironments.in }
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

  async getCustomProviderVersionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    customProviderVersionId: string;
  }) {
    let customProviderVersion = await db.customProviderVersion.findFirst({
      where: {
        id: d.customProviderVersionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!customProviderVersion)
      throw new ServiceError(
        notFoundError('custom_provider.version', d.customProviderVersionId)
      );

    return customProviderVersion;
  }
}

export let customProviderVersionService = Service.create(
  'customProviderVersion',
  () => new customProviderVersionServiceImpl()
).build();
