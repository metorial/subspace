import type {
  Provider,
  ProviderAuthConfig,
  ProviderConfig,
  ProviderDeployment,
  Session,
  SessionProvider
} from '@metorial-subspace/db';
import { sessionProviderPresenter } from './sessionProvider';

export let sessionPresenter = (
  session: Session & {
    providers: (SessionProvider & {
      provider: Provider;
      deployment: ProviderDeployment;
      config: ProviderConfig;
      authConfig: ProviderAuthConfig | null;
    })[];
  }
) => ({
  object: 'session',

  id: session.id,

  name: session.name,
  description: session.description,
  metadata: session.metadata,

  usage: {
    totalProductiveClientMessageCount: session.totalProductiveClientMessageCount,
    totalProductiveServerMessageCount: session.totalProductiveServerMessageCount
  },

  providers: session.providers.filter(p => p.status == 'active').map(sessionProviderPresenter),

  createdAt: session.createdAt,
  updatedAt: session.updatedAt
});
