import { useSetupSession } from '../../state/setupSession';

export let SetupSessionPage = () => {
  let setupSession = useSetupSession();

  if (setupSession.error) {
    return 'Error page... (already in ui kit)';
  }

  return 'Data Loaded';
};
