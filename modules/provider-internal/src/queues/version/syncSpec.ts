import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../../env';
import { providerSpecificationInternalService } from '../../services/providerSpecification';
import { providerVersionSetSpecificationQueue } from './setSpec';

export let providerVersionSyncSpecificationQueue = createQueue<{ providerVersionId: string }>({
  name: 'sub/pint/pver/spec/sync',
  redisUrl: env.service.REDIS_URL
});

export let providerVersionSyncSpecificationQueueProcessor =
  providerVersionSyncSpecificationQueue.process(async data => {
    let version = await db.providerVersion.findFirst({
      where: { id: data.providerVersionId },
      include: { provider: true, providerVariant: true }
    });
    if (!version) throw new QueueRetryError();

    let backend = await getBackend({
      entity: version
    });

    try {
      let capabilities = await backend.capabilities.getSpecificationForProviderVersion({
        providerVersion: version,
        provider: version.provider,
        providerVariant: version.providerVariant
      });

      // Some backends might need a config to be able to discover specifications
      if (!capabilities) {
        await providerVersionSetSpecificationQueue.add({
          versionOid: version.oid,
          result: { status: 'not_discoverable' }
        });
        return;
      }

      let spec = await providerSpecificationInternalService.ensureProviderSpecification({
        provider: version.provider,
        providerVersion: version,

        specification: capabilities.specification,
        authMethods: capabilities.authMethods,
        features: capabilities.features,
        tools: capabilities.tools
      });

      await providerVersionSetSpecificationQueue.add({
        versionOid: version.oid,
        result: {
          status: 'success',
          specificationOid: spec.oid
        }
      });
    } catch (e) {
      if (version.specificationOid) return; // Already discovered

      await providerVersionSetSpecificationQueue.add({
        versionOid: version.oid,
        result: { status: 'not_discoverable' }
      });

      throw e; // We still want to retry
    }
  });
