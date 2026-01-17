import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveProviderDeployments = createResolver(async ({ ts, ids }) =>
  db.providerDeployment.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderConfigs = createResolver(async ({ ts, ids }) =>
  db.providerConfig.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderConfigVaults = createResolver(async ({ ts, ids }) =>
  db.providerConfigVault.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthConfigs = createResolver(async ({ ts, ids }) =>
  db.providerAuthConfig.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthCredentials = createResolver(async ({ ts, ids }) =>
  db.providerAuthCredentials.findMany({
    where: {
      ...ts,
      id: { in: ids }
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthMethods = createResolver(async ({ ts, ids }) =>
  db.providerAuthMethod.findMany({
    where: {
      OR: [{ id: { in: ids } }],

      provider: {
        OR: [
          { access: 'public' as const },
          {
            access: 'tenant' as const,
            ownerTenantOid: ts.tenantOid,
            ownerSolutionOid: ts.solutionOid
          }
        ]
      }
    },
    select: { oid: true }
  })
);
