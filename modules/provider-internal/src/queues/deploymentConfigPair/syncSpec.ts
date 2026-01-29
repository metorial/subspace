import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { providerSpecificationInternalService } from '../../services/providerSpecification';
import { providerDeploymentConfigPairSetSpecificationQueue } from './setSpec';

export let providerDeploymentConfigPairSyncSpecificationQueue = createQueue<{
  providerDeploymentConfigPairId: string;
  versionId: string;
}>({
  name: 'pint/pdep/spec/sync',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairSyncSpecificationQueueProcessor =
  providerDeploymentConfigPairSyncSpecificationQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: data.providerDeploymentConfigPairId },
      include: {
        tenant: true,
        providerConfig: true,
        providerDeployment: {
          include: { providerVariant: true, provider: true, lockedVersion: true }
        }
      }
    });
    if (!pair) throw new QueueRetryError();

    let backend = await getBackend({
      entity: pair.providerDeployment.providerVariant
    });

    let version = await db.providerVersion.findFirstOrThrow({
      where: { id: data.versionId }
    });

    try {
      let discoverParams = {
        tenant: pair.tenant,
        deployment: pair.providerDeployment,

        provider: pair.providerDeployment.provider,
        providerVariant: pair.providerDeployment.providerVariant,
        providerVersion: version
      };

      if (version.specificationOid) {
        let isNeeded =
          await backend.capabilities.isSpecificationForProviderDeploymentVersionSameAsForVersion(
            discoverParams
          );

        if (!isNeeded) {
          await providerDeploymentConfigPairSetSpecificationQueue.add({
            providerDeploymentConfigPairOid: pair.oid,
            versionOid: version.oid,
            result: { status: 'success', specificationOid: version.specificationOid }
          });
          return;
        }
      }

      let capabilities =
        await backend.capabilities.getSpecificationForProviderPair(discoverParams);

      // Some backends might need a config to be able to discover specifications
      if (!capabilities) {
        await providerDeploymentConfigPairSetSpecificationQueue.add({
          providerDeploymentConfigPairOid: pair.oid,
          versionOid: version.oid,
          result: { status: 'failure' }
        });
        return;
      }

      let spec = await providerSpecificationInternalService.ensureProviderSpecification({
        provider: pair.providerDeployment.provider,
        providerVersion: version,

        specification: capabilities.specification,
        authMethods: capabilities.authMethods,
        features: capabilities.features,
        tools: capabilities.tools
      });

      await providerDeploymentConfigPairSetSpecificationQueue.add({
        providerDeploymentConfigPairOid: pair.oid,
        versionOid: version.oid,
        result: { status: 'success', specificationOid: spec.oid }
      });
    } catch (e) {
      await providerDeploymentConfigPairSetSpecificationQueue.add({
        providerDeploymentConfigPairOid: pair.oid,
        versionOid: version.oid,
        result: { status: 'failure' }
      });

      throw e; // We still want to retry
    }
  });
