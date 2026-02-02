import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { ProviderSpecificationGetRes } from '@metorial-subspace/provider-utils';
import { env } from '../../env';
import { providerSpecificationInternalService } from '../../services/providerSpecification';
import { providerDeploymentConfigPairSetSpecificationQueue } from './setSpec';

export let providerDeploymentConfigPairSyncSpecificationQueue = createQueue<{
  providerDeploymentConfigPairId: string;
  versionId: string;
}>({
  name: 'sub/pint/pdep/spec/sync',
  redisUrl: env.service.REDIS_URL
});

export let providerDeploymentConfigPairSyncSpecificationQueueProcessor =
  providerDeploymentConfigPairSyncSpecificationQueue.process(async data => {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: data.providerDeploymentConfigPairId },
      include: {
        tenant: true,
        providerConfigVersion: true,
        providerAuthConfigVersion: true,
        providerDeploymentVersion: {
          include: {
            deployment: {
              include: { providerVariant: true, provider: true }
            }
          }
        }
      }
    });
    if (!pair) throw new QueueRetryError();

    let providerDeployment = pair.providerDeploymentVersion.deployment;

    let backend = await getBackend({
      entity: providerDeployment.providerVariant
    });

    let version = await db.providerVersion.findFirstOrThrow({
      where: { id: data.versionId },
      include: { specification: true }
    });

    try {
      let discoverParams = {
        tenant: pair.tenant,
        provider: providerDeployment.provider,
        providerVariant: providerDeployment.providerVariant,
        providerVersion: version,

        deploymentVersion: pair.providerDeploymentVersion,
        configVersion: pair.providerConfigVersion,
        authConfigVersion: pair.providerAuthConfigVersion
      };

      if (version.specificationOid) {
        // If we have the full spec, we can skip discovery
        let alreadyHasFullSpec = version.specification?.type == 'full';

        if (alreadyHasFullSpec) {
          await providerDeploymentConfigPairSetSpecificationQueue.add({
            providerDeploymentConfigPairOid: pair.oid,
            versionOid: version.oid,
            result: { status: 'success', specificationOid: version.specificationOid }
          });
          return;
        }
      }

      let capabilities: ProviderSpecificationGetRes = null;

      try {
        capabilities =
          await backend.capabilities.getSpecificationForProviderPair(discoverParams);
      } catch (e) {
        console.error('Error discovering capabilities:', e);
      }

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
        provider: providerDeployment.provider,
        providerVersion: version,

        type: capabilities.type,

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
