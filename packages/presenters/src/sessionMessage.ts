import type {
  ProviderRun,
  Session,
  SessionConnection,
  SessionError,
  SessionErrorGroup,
  SessionMessage,
  SessionParticipant,
  SessionProvider
} from '@metorial-subspace/db';

export let sessionMessagePresenter = async (
  message: SessionMessage & {
    session: Session;
    senderParticipant: SessionParticipant;
    sessionProvider: SessionProvider | null;
    responderParticipant: SessionParticipant | null;
    connection: SessionConnection | null;
    providerRun: ProviderRun | null;
    error:
      | (SessionError & {
          session: Session;
          group: SessionErrorGroup | null;
          providerRun: ProviderRun | null;
          connection: SessionConnection | null;
        })
      | null;
  }
) => {
  return {
    object: 'session.connection',

    id: message.id,
    status: message.status,
    type: message.type,

    sessionId: message.session.id,

    createdAt: message.createdAt
  };
};
