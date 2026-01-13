import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';

export let rootFrontend = app.controller({});

export let subspaceFrontendRPC = createServer({})(rootFrontend);
export let subspaceFrontendApi = apiMux([
  { endpoint: rpcMux({ path: '/subspace-public/internal-api' }, [subspaceFrontendRPC]) }
]);

export type SubspaceFrontendClient = InferClient<typeof rootFrontend>;
