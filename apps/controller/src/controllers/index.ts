import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { solutionController } from './solution';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  solution: solutionController
});

export let subspaceControllerRPC = createServer({})(rootController);
export let subspaceControllerApi = apiMux([
  { endpoint: rpcMux({ path: '/subspace-controller' }, [subspaceControllerRPC]) }
]);

export type SubspaceControllerClient = InferClient<typeof rootController>;
