import { createLoader } from '@metorial-io/data-hooks';
import { client } from './client';

export let setupSessionState = createLoader({
  name: 'setupSession',
  fetch: (d: { sessionId: string; clientSecret: string }) =>
    client.setupSession.get({
      sessionId: d.sessionId,
      clientSecret: d.clientSecret
    }),
  mutators: {}
});

export let useSetupSession = (d: {
  input: { sessionId: string; clientSecret: string };
  data: Awaited<ReturnType<typeof client.setupSession.get>>;
}) => {
  let data = setupSessionState.use(d.input);
  if (!data.data && !data.error) data.data = d.data;

  return data;
};
