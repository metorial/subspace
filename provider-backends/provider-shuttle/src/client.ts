import {
  createLiveConnectionClient,
  createShuttleClient
} from '@metorial-services/shuttle-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let shuttle = createShuttleClient({
  endpoint: env.service.SHUTTLE_URL
});

export let shuttleLiveClient = await createLiveConnectionClient({
  endpoint: env.service.SHUTTLE_LIVE_URL
});

export let shuttleDefaultReaderTenant = await shuttle.tenant.upsert({
  name: 'Subspace Default Reader',
  identifier: 'subspace-default-reader'
});

export let getTenantForShuttle = async (tenant: Tenant) => {
  if (!tenant.shuttleTenantId) {
    let shuttleTenant = await shuttle.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        shuttleTenantId: shuttleTenant.id,
        shuttleTenantIdentifier: shuttleTenant.identifier
      }
    });
  }

  return {
    id: tenant.shuttleTenantId!,
    identifier: tenant.shuttleTenantIdentifier!
  };
};

export type ContainerRegistry = Awaited<ReturnType<typeof shuttle.containerRegistry.get>>;
export type ContainerRepository = Awaited<ReturnType<typeof shuttle.containerRepository.get>>;
