import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  Actor,
  CustomProvider,
  CustomProviderVersionStatus,
  db,
  withTransaction,
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
import { backend } from '../_shuttle/backend';
import { CustomProviderConfig, CustomProviderFrom } from '../_shuttle/types';
import { createVersion } from '../internal/createVersion';
import { ensureEnvironments } from '../internal/ensureEnvironments';

let include = {
  customProvider: {
    include: {
      provider: true
    }
  },
  deployment: {
    include: { commit: true }
  },
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

      from: CustomProviderFrom;
      config?: CustomProviderConfig;
    };
  }) {
    checkTenant(d, d.customProvider);
    checkDeletedRelation(d.customProvider);

    let backendProvider = await backend.createCustomProviderVersion({
      tenant: d.tenant,

      from: d.input.from,
      config: d.input.config!,

      customProvider: d.customProvider
    });

    return withTransaction(async db => {
      await ensureEnvironments(d);

      let versionRes = await createVersion({
        actor: d.actor,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        message: d.input.message,

        trigger: 'manual',
        customProvider: d.customProvider,

        shuttleServer: backendProvider.shuttleServer,
        shuttleCustomServer: backendProvider.shuttleCustomServer,
        shuttleCustomDeployment: backendProvider.shuttleCustomDeployment
      });

      return await db.customProviderVersion.findUniqueOrThrow({
        where: { oid: versionRes.version.oid, tenantOid: d.tenant.oid },
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
