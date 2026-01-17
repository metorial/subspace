import {
  type Provider,
  type ProviderRun,
  type Session,
  type SessionConnection,
  type SessionError,
  type SessionErrorGroup,
  type SessionEvent,
  type SessionMessage,
  type SessionParticipant,
  type SessionProvider
} from '@metorial-subspace/db';
import { providerRunPresenter } from './providerRun';
import { sessionConnectionPresenter } from './sessionConnection';
import { sessionErrorPresenter } from './sessionError';
import { sessionMessagePresenter } from './sessionMessage';

export let sessionEventPresenter = async (
  event: SessionEvent & {
    session: Session;
    providerRun:
      | (ProviderRun & {
          sessionProvider: SessionProvider;
          provider: Provider;
          connection: SessionConnection;
        })
      | null;
    message:
      | (SessionMessage & {
          senderParticipant: SessionParticipant;
          sessionProvider: SessionProvider | null;
          responderParticipant: SessionParticipant | null;
          connection: SessionConnection | null;
          providerRun: ProviderRun | null;
        })
      | null;
    connection:
      | (SessionConnection & {
          participant:
            | (SessionParticipant & {
                provider: Provider | null;
              })
            | null;
        })
      | null;
    error:
      | (SessionError & {
          group: SessionErrorGroup | null;
          providerRun: ProviderRun | null;
          connection: SessionConnection | null;
        })
      | null;
  }
) => {
  return {
    object: 'session.event',

    id: event.id,
    type: event.type,

    sessionId: event.session.id,

    connection: event.connection
      ? sessionConnectionPresenter({
          ...event.connection,
          session: event.session
        })
      : null,

    providerRun: event.providerRun
      ? providerRunPresenter({
          ...event.providerRun,
          session: event.session
        })
      : null,

    message: event.message
      ? await sessionMessagePresenter({
          ...event.message,
          session: event.session,
          error: event.error ? { ...event.error, session: event.session } : null
        })
      : null,

    error: event.error
      ? await sessionErrorPresenter({
          ...event.error,
          session: event.session
        })
      : null,

    createdAt: event.createdAt
  };
};
