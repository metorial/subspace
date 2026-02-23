import { db, getId, type Session, type SessionConnection } from '@metorial-subspace/db';

export interface CreateWarningProps {
  connection: SessionConnection | null | undefined;
  session: Session;

  warning: {
    code: string;
    message: string;
    payload: Record<string, any>;
  };
}

export let createWarning = async (props: CreateWarningProps) => {
  let warning = await db.sessionWarning.create({
    data: {
      ...getId('sessionWarning'),

      code: props.warning.code,
      message: props.warning.message,
      payload: props.warning.payload,

      sessionOid: props.session.oid,
      tenantOid: props.session.tenantOid,
      solutionOid: props.session.solutionOid,
      environmentOid: props.session.environmentOid
    }
  });

  await db.sessionEvent.createMany({
    data: {
      ...getId('sessionEvent'),
      type: 'warning_occurred',
      sessionOid: warning.sessionOid,
      warningOid: warning.oid,
      tenantOid: warning.tenantOid,
      environmentOid: warning.environmentOid,
      solutionOid: warning.solutionOid
    }
  });

  return warning;
};
