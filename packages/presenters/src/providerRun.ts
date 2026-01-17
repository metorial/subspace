import type {
  Provider,
  ProviderRun,
  Session,
  SessionConnection,
  SessionProvider
} from '@metorial-subspace/db';

export let providerRunPresenter = (
  providerRun: ProviderRun & {
    session: Session;
    sessionProvider: SessionProvider;
    provider: Provider;
    connection: SessionConnection;
  }
) => ({
  object: 'provider.run',

  id: providerRun.id,
  status: providerRun.status,

  providerId: providerRun.provider.id,
  sessionId: providerRun.session.id,
  sessionProviderId: providerRun.sessionProvider.id,
  connectionId: providerRun.connection.id,

  createdAt: providerRun.createdAt,
  updatedAt: providerRun.updatedAt,
  completedAt: providerRun.completedAt
});
