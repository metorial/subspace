import { db, getId } from '@metorial-subspace/db';
import type { ConnectionBaseState } from './base';

export let createProviderRun = async ({
  instance,
  version,
  session,
  connection
}: ConnectionBaseState) => {
  let providerRun = await db.providerRun.create({
    data: {
      ...getId('providerRun'),
      providerOid: instance.sessionProvider.providerOid,
      providerVersionOid: version.oid,
      sessionOid: instance.sessionProvider.sessionOid,
      instanceOid: instance.oid,
      connectionOid: connection.oid,
      sessionProviderOid: instance.sessionProvider.oid,
      tenantOid: session.tenantOid,
      solutionOid: session.solutionOid
    }
  });

  db.sessionEvent
    .createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'provider_run_started',
        sessionOid: session.oid,
        connectionOid: connection.oid,
        providerRunOid: providerRun.oid,
        tenantOid: session.tenantOid,
        solutionOid: session.solutionOid
      }
    })
    .catch(() => {});

  return providerRun;
};
