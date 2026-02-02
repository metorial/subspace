import { createClient } from '@lowerdeck/rpc-client';
import type { SubspaceControllerClient } from '../../apps/controller/src/controllers';

let createSubspaceControllerClient = (
  o: Parameters<typeof createClient<SubspaceControllerClient>>[0]
) => createClient<SubspaceControllerClient>(o);

let initialClient = createSubspaceControllerClient({
  endpoint: 'http://localhost:52070/subspace-controller'
});

export let solution = await initialClient.solution.upsert({
  identifier: 's1',
  name: 'Solution 1'
});

export let client = createSubspaceControllerClient({
  endpoint: 'http://localhost:52070/subspace-controller',
  headers: {
    'Subspace-Solution-Id': solution.id
  }
});

export let tenant = await client.tenant.upsert({
  identifier: 't1',
  name: 'Tenant 1',
  environments: []
});

export let environment = await client.environment.upsert({
  tenantId: tenant.id,
  identifier: 'e_dev1',
  name: 'Development 1',
  type: 'development'
});

export let actor = await client.actor.upsert({
  tenantId: tenant.id,
  name: 'Actor 1',
  type: 'external',
  organizationActorId: 'org-actor-1',
  identifier: 'a1'
});

export let ts = {
  tenantId: tenant.id,
  environmentId: environment.id,
  solutionId: solution.id
};
