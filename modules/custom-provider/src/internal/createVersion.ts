import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import {
  Actor,
  addAfterTransactionHook,
  CustomProvider,
  CustomProviderDeploymentTrigger,
  db,
  Environment,
  getId,
  Provider,
  ProviderVersion,
  ShuttleCustomServer,
  ShuttleCustomServerDeployment,
  ShuttleServer,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { actorService } from '@metorial-subspace/module-tenant';
import { customProviderDeploymentCreatedQueue } from '../queues/lifecycle/customProviderDeployment';
import { ensureEnvironments } from './ensureEnvironments';
import { linkNewShuttleVersionToCustomProvider } from './linkVersion';

export let createVersion = (d: {
  actor: Actor;
  tenant: Tenant;
  solution: Solution;
  environment: Environment;

  message: string | undefined;

  trigger: CustomProviderDeploymentTrigger;

  customProvider: CustomProvider;

  shuttleServer: ShuttleServer;
  shuttleCustomServer: ShuttleCustomServer;
  shuttleCustomDeployment: ShuttleCustomServerDeployment;

  forVersion?: {
    provider: Provider;
    providerVersion: ProviderVersion;
  };
}) =>
  withTransaction(async db => {
    await db.customProvider.updateMany({
      where: { oid: d.customProvider.oid },
      data: {
        shuttleCustomServerOid: d.shuttleCustomServer.oid
      }
    });

    let deployment = await db.customProviderDeployment.create({
      data: {
        ...getId('customProviderDeployment'),
        status: 'queued',
        trigger: d.trigger,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        creatorActorOid: d.actor.oid,

        customProviderOid: d.customProvider.oid,

        shuttleCustomServerOid: d.shuttleCustomServer.oid,
        shuttleCustomServerDeploymentOid: d.shuttleCustomDeployment.oid
      }
    });

    let { maxVersionIndex } = await db.customProvider.update({
      where: { oid: d.customProvider.oid },
      data: {
        maxVersionIndex: { increment: 1 }
      }
    });

    let version = await db.customProviderVersion.create({
      data: {
        ...getId('customProviderVersion'),
        status: 'queued',

        versionIndex: maxVersionIndex,
        versionIdentifier: generatePlainId(8),

        deploymentOid: deployment.oid,
        customProviderOid: d.customProvider.oid,

        shuttleCustomServerOid: d.shuttleCustomServer.oid,
        shuttleCustomServerDeploymentOid: d.shuttleCustomDeployment.oid,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        creatorActorOid: d.actor.oid,

        providerVersionOid: d.forVersion?.providerVersion.oid || null
      }
    });

    let env = await db.customProviderEnvironment.upsert({
      where: {
        environmentOid_customProviderOid: {
          environmentOid: d.environment.oid,
          customProviderOid: d.customProvider.oid
        }
      },
      create: {
        ...getId('customProviderEnvironment'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        customProviderOid: d.customProvider.oid
      },
      update: {},
      include: {
        providerEnvironment: {
          include: { currentVersion: { include: { customProviderVersion: true } } }
        }
      }
    });

    let commit = await db.customProviderCommit.create({
      data: {
        ...getId('customProviderCommit'),
        status: 'pending',
        trigger: d.trigger,
        type: 'create_version',

        message: d.message,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        creatorActorOid: d.actor.oid,

        toEnvironmentOid: env.oid,
        toEnvironmentVersionBeforeOid:
          env.providerEnvironment?.currentVersion?.customProviderVersion?.oid || null,

        targetCustomProviderVersionOid: version.oid,
        customProviderOid: d.customProvider.oid
      }
    });

    await db.customProviderEnvironmentVersion.create({
      data: {
        ...getId('customProviderEnvironmentVersion'),
        customProviderEnvironmentOid: env.oid,
        customProviderVersionOid: version.oid,
        environmentOid: d.environment.oid,
        commitOid: commit.oid
      }
    });

    await db.customProviderDeployment.updateMany({
      where: { oid: deployment.oid },
      data: {
        sourceEnvironmentOid: env.oid,
        commitOid: commit.oid
      }
    });

    await addAfterTransactionHook(() =>
      customProviderDeploymentCreatedQueue.add({
        customProviderDeploymentId: deployment.id
      })
    );

    return { deployment, version };
  });

export let syncVersionToCustomProvider = async (d: {
  providerVersion: ProviderVersion;

  message: string;

  shuttleServer: ShuttleServer;
  shuttleCustomServer: ShuttleCustomServer;
  shuttleCustomDeployment: ShuttleCustomServerDeployment;
}) => {
  let fullProviderVersion = await db.providerVersion.findUniqueOrThrow({
    where: { oid: d.providerVersion.oid },
    include: {
      customProviderVersion: true,
      provider: {
        include: {
          customProvider: {
            include: {
              tenant: true,
              solution: true
            }
          }
        }
      }
    }
  });
  if (!fullProviderVersion.customProviderVersion) return;
  if (!fullProviderVersion.provider.customProvider) return;

  let customProvider = fullProviderVersion.provider.customProvider;

  let environments = await ensureEnvironments({
    customProvider
  });

  let actor = await actorService.getSystemActor({
    tenant: customProvider.tenant
  });

  let sortedEnvironments = environments.sort(
    (a, b) => a.environment.createdAt.getTime() - b.environment.createdAt.getTime()
  );
  let environment =
    sortedEnvironments.find(e => e.environment.type == 'development') ?? sortedEnvironments[0];
  if (!environment) {
    throw new ServiceError(
      badRequestError({
        message: 'No environments found for custom provider'
      })
    );
  }

  await withTransaction(async db => {
    await createVersion({
      actor,
      tenant: customProvider.tenant,
      solution: customProvider.solution,
      environment: environment.environment,

      message: d.message,
      trigger: 'system',

      customProvider,

      shuttleServer: d.shuttleServer,
      shuttleCustomServer: d.shuttleCustomServer,
      shuttleCustomDeployment: d.shuttleCustomDeployment
    });

    await linkNewShuttleVersionToCustomProvider({
      customProviderVersion: fullProviderVersion.customProviderVersion!,
      provider: fullProviderVersion.provider,
      providerVersion: fullProviderVersion
    });
  });
};
