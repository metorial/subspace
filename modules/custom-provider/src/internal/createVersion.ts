import {
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
  tenant: Tenant;
  solution: Solution;
  environment: Environment;

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

        deploymentOid: deployment.oid,
        customProviderOid: d.customProvider.oid,

        shuttleCustomServerOid: d.shuttleCustomServer.oid,
        shuttleCustomServerDeploymentOid: d.shuttleCustomDeployment.oid,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      }
    });

    let env = await db.customProviderEnvironment.findUniqueOrThrow({
      where: {
        environmentOid_customProviderOid: {
          environmentOid: d.environment.oid,
          customProviderOid: d.customProvider.oid
        }
      }
    });
    await db.customProviderEnvironmentVersion.create({
      data: {
        ...getId('customProviderEnvironmentVersion'),
        customProviderEnvironmentOid: env.oid,
        customProviderVersionOid: version.oid,
        environmentOid: d.environment.oid
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
