import { ScmProviderSetupSession } from '../origin';
import { scmProviderPresenter } from './scmProvider';

export let scmProviderSetupSessionPresenter = (
  scmProviderSetupSession: ScmProviderSetupSession
) => ({
  object: 'scm_provider.setup_session',

  id: scmProviderSetupSession.id,

  type: scmProviderSetupSession.type,
  url: scmProviderSetupSession.url,
  status: scmProviderSetupSession.status,

  provider: scmProviderSetupSession.backend
    ? scmProviderPresenter(scmProviderSetupSession.backend)
    : null,

  createdAt: scmProviderSetupSession.createdAt,
  expiresAt: scmProviderSetupSession.expiresAt
});
