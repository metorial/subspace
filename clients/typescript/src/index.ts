import { createClient } from '@lowerdeck/rpc-client';
import type { SubspaceControllerClient } from '../../../apps/controller/src/controllers';

export let createSubspaceControllerClient = (
  o: Parameters<typeof createClient<SubspaceControllerClient>>[0]
) => createClient<SubspaceControllerClient>(o);
