import { createShuttleClient } from '@metorial-services/shuttle-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let shuttle = createShuttleClient({
  endpoint: env.service.SHUTTLE_URL
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
