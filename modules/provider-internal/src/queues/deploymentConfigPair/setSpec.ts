import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  ProviderDeploymentConfigPairSpecificationDiscoveryStatus
} from '@metorial-subspace/db';
import { env } from '../../env';
import { providerVersionSetSpecificationQueue } from '../version/setSpec';

export let providerDeploymentConfigPairSetSpecificationQueue = createQueue<{
  providerDeploymentConfigPairOid: bigint;
  versionOid: bigint;
  result:
    | {
        status: 'success';
        specificationOid: bigint;
      }
    | {
        status: 'failure';
      };
}>({
  name: 'pint/pdep/spec/set',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairSetSpecificationQueueProcessor =
  providerDeploymentConfigPairSetSpecificationQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { oid: data.providerDeploymentConfigPairOid },
      include: { providerDeployment: true }
    });
    if (!pair) throw new QueueRetryError();

    let version = await db.providerVersion.findFirst({
      where: {
        oid: data.versionOid,
        providerVariantOid: pair.providerDeployment.providerVariantOid
      }
    });
    if (!version) throw new QueueRetryError();

    let pairVersion = await db.providerDeploymentConfigPairProviderVersion.findUnique({
      where: {
        pairOid_versionOid: {
          pairOid: data.providerDeploymentConfigPairOid,
          versionOid: data.versionOid
        }
      },
      include: { previousPairVersion: true }
    });

    let filter = {
      pairOid: data.providerDeploymentConfigPairOid,
      versionOid: data.versionOid
    };

    let result: {
      specificationDiscoveryStatus: ProviderDeploymentConfigPairSpecificationDiscoveryStatus;
      specificationOid: bigint | null;
    };

    if (data.result.status === 'success') {
      result = {
        specificationDiscoveryStatus: 'discovered',
        specificationOid: data.result.specificationOid
      };
    } else {
      result = {
        specificationDiscoveryStatus: 'failed',
        specificationOid: null
      };
    }

    let newPairVersion = await db.providerDeploymentConfigPairProviderVersion.upsert({
      where: {
        pairOid_versionOid: filter
      },
      create: {
        ...getId('providerDeploymentConfigPairProviderVersion'),
        ...filter,
        ...result
      },
      update: result
    });

    if (newPairVersion.specificationOid) {
      if (!version.slateVersionOid) {
        await providerVersionSetSpecificationQueue.add({
          versionOid: version.oid,
          result: {
            status: 'success',
            specificationOid: newPairVersion.specificationOid
          }
        });
      }

      if (
        pairVersion?.previousPairVersion?.specificationOid &&
        newPairVersion.specificationOid != pairVersion.previousPairVersion.specificationOid
      ) {
        try {
          let change = await db.providerDeploymentConfigPairSpecificationChange.create({
            data: {
              ...getId('providerDeploymentConfigPairSpecificationChange'),

              toPairVersionOid: newPairVersion.oid,
              fromPairVersionOid: pairVersion.previousPairVersion.oid,

              toSpecificationOid: newPairVersion.specificationOid,
              fromSpecificationOid: pairVersion.previousPairVersion.specificationOid
            }
          });
          await db.providerSpecificationChangeNotification.create({
            data: {
              ...getId('providerSpecificationChangeNotification'),

              tenantOid: pair.providerDeployment.tenantOid,
              solutionOid: pair.providerDeployment.solutionOid,

              target: 'deployment_config_pair',
              versionOid: version.oid,
              pairSpecificationChangeOid: change.oid,
              deploymentConfigPairOid: newPairVersion.pairOid
            }
          });
        } catch (e) {
          // Maybe a unique constraint violation, ignore for now
        }
      }
    }
  });
