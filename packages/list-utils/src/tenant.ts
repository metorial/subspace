import { type Solution, type Tenant } from '@metorial-subspace/db';

export interface TenantSelector {
  tenant: Tenant;
  solution: Solution;
}
