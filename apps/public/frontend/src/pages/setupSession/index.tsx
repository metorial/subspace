import type { ErrorData } from '@lowerdeck/error';
import { htmlDecode } from '../../../../src/lib/htmlEncode';
import { useSetupSession } from '../../state';
import { client } from '../../state/client';

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

export let SetupSessionPage = () => {
  if (PRELOAD.type === 'error') {
    return 'Error';
  }

  let setupSession = useSetupSession(PRELOAD);

  return 'Data Loaded';
};
