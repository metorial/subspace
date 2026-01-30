import { generatePlainId } from '@lowerdeck/id';
import {
  Actor,
  addAfterTransactionHook,
  CustomProvider,
  CustomProviderDeploymentTrigger,
  Environment,
  getId,
  ShuttleCustomServer,
  ShuttleCustomServerDeployment,
  ShuttleServer,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { customProviderDeploymentCreatedQueue } from '../queues/lifecycle/customProviderDeployment';

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
}) =>
  withTransaction(async db => {
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
        creatorActorOid: d.actor.oid
      }
    });

    let env = await db.customProviderEnvironment.findUnique({
      where: {
        environmentOid_customProviderOid: {
          environmentOid: d.environment.oid,
          customProviderOid: d.customProvider.oid
        }
      },
      include: {
        providerEnvironment: {
          include: { currentVersion: { include: { customProviderVersion: true } } }
        }
      }
    });
    if (!env) {
      env = await db.customProviderEnvironment.upsert({
        where: {
          environmentOid_customProviderOid: {
            environmentOid: d.environment.oid,
            customProviderOid: d.customProvider.oid
          }
        },
        create: {
          ...getId('customProviderEnvironment'),
          tenantOid: d.tenant.oid,
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
    }

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
      data: { sourceEnvironmentOid: env.oid }
    });

    await addAfterTransactionHook(() =>
      customProviderDeploymentCreatedQueue.add({
        customProviderDeploymentId: deployment.id
      })
    );

    return { deployment, version };
  });
