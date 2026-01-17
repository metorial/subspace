import { delay } from '@lowerdeck/delay';
import {
  db,
  type ProviderRun,
  type Session,
  type SessionConnection,
  type SessionError,
  type SessionErrorGroup
} from '@metorial-subspace/db';

export let sessionErrorPresenter = async (
  error: SessionError & {
    session: Session;
    group: SessionErrorGroup | null;
    providerRun: ProviderRun | null;
    connection: SessionConnection | null;
  }
) => {
  let i = 0;
  while (!error.isProcessing || !error.group) {
    if (i++ >= 50) break;

    await delay(250);

    let refreshedError = await db.sessionError.findUniqueOrThrow({
      where: { oid: error.oid },
      include: { group: true }
    });

    error = Object.assign(error, refreshedError);
  }

  return {
    object: 'session.provider',

    id: error.id,

    code: error.code,
    message: error.message,

    data: error.payload,

    sessionId: error.session.id,
    providerRunId: error.providerRun?.id || null,
    connectionId: error.connection?.id || null,

    groupId: error.group?.id!,
    similarErrorCount: error.group?.occurrenceCount ?? 0,

    createdAt: error.createdAt
  };
};
