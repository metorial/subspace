import type { Session, SessionUsageRecord, Tenant } from '@metorial-subspace/db';

export let sessionUsageRecordPresenter = (
  sessionUsageRecord: SessionUsageRecord & {
    session: Session;
    tenant: Tenant;
  }
) => ({
  object: 'session_usage_record',

  id: sessionUsageRecord.id,

  session: {
    id: sessionUsageRecord.session.id,
    oid: sessionUsageRecord.session.oid,
    name: sessionUsageRecord.session.name
  },

  tenant: {
    id: sessionUsageRecord.tenant.id,
    name: sessionUsageRecord.tenant.name
  },

  clientMessageIncrement: sessionUsageRecord.clientMessageIncrement,
  providerMessageIncrement: sessionUsageRecord.providerMessageIncrement,

  createdAt: sessionUsageRecord.createdAt
});
