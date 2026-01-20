import type { Solution, Tenant } from '@metorial-subspace/db';

export interface TenantSelector {
  tenant: Tenant;
  solution: Solution;
}
