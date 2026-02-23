import { type Session, type SessionWarning } from '@metorial-subspace/db';

export type SessionWarningPresenterProps = SessionWarning & {
  session: Session;
};

export let sessionWarningPresenter = (error: SessionWarningPresenterProps) => ({
  object: 'session.warning',

  id: error.id,

  code: error.code,
  message: error.message,

  data: error.payload,

  sessionId: error.session.id,

  createdAt: error.createdAt
});
