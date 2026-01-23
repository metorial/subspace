import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { providerRunLogsController } from './providerRunLogs';
import { setupSessionController } from './setupSession';

export let rootFrontend = app.controller({
  providerRunLogs: providerRunLogsController,
  setupSession: setupSessionController
});

export let subspaceFrontendRPC = createServer({})(rootFrontend);

export type SubspaceFrontendClient = InferClient<typeof rootFrontend>;
