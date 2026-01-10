import { createSlatesHubInternalClient } from '@metorial-services/slates-hub-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let slates = createSlatesHubInternalClient({
  endpoint: env.service.SLATES_HUB_URL
});

export let getTenantForSlates = async (tenant: Tenant) => {
  if (tenant.slateTenantId) {
    let slateTenant = await slates.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        slateTenantId: slateTenant.id,
        slateTenantIdentifier: slateTenant.identifier
      }
    });
  }

  return {
    id: tenant.slateTenantId,
    identifier: tenant.slateTenantIdentifier!
  };
};
