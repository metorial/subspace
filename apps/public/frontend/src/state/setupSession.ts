import { ErrorData, ServiceError } from '@lowerdeck/error';
import { createLoader } from '@metorial-io/data-hooks';
import { htmlDecode } from '../../../src/lib/htmlEncode';
import { client } from './client';

let PRELOAD = JSON.parse(htmlDecode(document.querySelector('#preload-data')?.textContent!)) as
  | {
      type: 'error';
      error: ErrorData<string, number>;
    }
  | {
      type: 'data';
      data: Awaited<ReturnType<typeof client.setupSession.get>>;
      input: { sessionId: string; clientSecret: string };
    };

export let setupSessionState = createLoader({
  name: 'setupSession',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let authConfigSchemaState = createLoader({
  name: 'authConfigSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.getAuthConfigSchema({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let configSchemaState = createLoader({
  name: 'configSchema',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.getConfigSchema({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let useSetupSession = () => {
  let data = setupSessionState.use(
    PRELOAD.type === 'error'
      ? null
      : {
          sessionId: PRELOAD.data.session.id,
          clientSecret: PRELOAD.input.clientSecret
        }
  );

  if (PRELOAD.type === 'data' && !data.data && !data.error) data.data = PRELOAD.data;
  if (PRELOAD.type === 'error' && !data.data && !data.error)
    data.error = ServiceError.fromResponse(PRELOAD.error);

  return data;
};
