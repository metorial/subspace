import type { Session, SessionEvent } from '@metorial-subspace/db';
import { type ProviderRunPresenterProps, providerRunPresenter } from './providerRun';
import {
  type SessionConnectionPresenterProps,
  sessionConnectionPresenter
} from './sessionConnection';
import { type SessionErrorPresenterProps, sessionErrorPresenter } from './sessionError';
import { type SessionMessagePresenterProps, sessionMessagePresenter } from './sessionMessage';

export let sessionEventPresenter = async (
  event: SessionEvent & {
    session: Session;
    providerRun: ProviderRunPresenterProps | null;
    message: SessionMessagePresenterProps | null;
    connection: SessionConnectionPresenterProps | null;
    error: SessionErrorPresenterProps | null;
  }
) => {
  return {
    object: 'session.event',

    id: event.id,
    type: event.type,

    sessionId: event.session.id,

    connection: event.connection
      ? await sessionConnectionPresenter({
          ...event.connection,
          session: event.session
        })
      : null,

    providerRun: event.providerRun
      ? await providerRunPresenter({
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
