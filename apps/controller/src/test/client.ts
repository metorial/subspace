import { createClient } from '@lowerdeck/rpc-client';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { appWithoutSolution } from '../controllers/_app';
import { solutionController } from '../controllers/solution';
import { tenantController } from '../controllers/tenant';

let testRootController = appWithoutSolution.controller({
  solution: solutionController,
  tenant: tenantController
});

let testRpc = rpcMux({ path: '/subspace-controller' }, [createServer({})(testRootController)]);

type ClientOptsLike = {
  endpoint: string;
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
};

let fetchRouter = createFetchRouter();
let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => testRpc.fetch(request));
};

let defaultEndpoint = 'http://subspace-controller.test/subspace-controller';

export let createSubspaceControllerTestClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<SubspaceControllerTestClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let subspaceControllerTestClient = createSubspaceControllerTestClient();
export type SubspaceControllerTestClient = InferClient<typeof testRootController>;
