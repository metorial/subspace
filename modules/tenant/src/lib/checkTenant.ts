import { Solution, Tenant } from '@metorial-subspace/db';

export let checkTenant = <
  T extends { tenantOid?: bigint | null; solutionOid?: bigint | null } | null | undefined
>(
  tenantData: {
    tenant: Tenant;
    solution?: Solution | null;
  },
  entity: T
) => {
  if (!entity) return;

  if (entity.tenantOid && entity.tenantOid !== tenantData.tenant.oid) {
    throw new Error('Tenant mismatch');
  }

  if (
    tenantData.solution &&
    entity.solutionOid &&
    entity.solutionOid !== tenantData.solution.oid
  ) {
    throw new Error('Solution mismatch');
  }
};
