import { CallbackReceiverRegistrationStatus, db, getId } from '@metorial-subspace/db';
import { slates } from '@metorial-subspace/provider-slates/src/client';

export let upsertRegistration = async (d: {
  callbackOid: bigint;
  providerDeploymentConfigPairOid: bigint;
  callbackTriggerOid: bigint;
  data: {
    slateTriggerBindingId: string;
    externalKey?: string | null;
    status: CallbackReceiverRegistrationStatus;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    lastSyncedAt: Date;
  };
}) => {
  let newId = getId('callbackReceiverRegistration');
  return await db.callbackReceiverRegistration.upsert({
    where: {
      callbackOid_providerDeploymentConfigPairOid_callbackTriggerOid: {
        callbackOid: d.callbackOid,
        providerDeploymentConfigPairOid: d.providerDeploymentConfigPairOid,
        callbackTriggerOid: d.callbackTriggerOid
      }
    },
    create: {
      ...newId,
      callbackOid: d.callbackOid,
      providerDeploymentConfigPairOid: d.providerDeploymentConfigPairOid,
      callbackTriggerOid: d.callbackTriggerOid,
      slateTriggerBindingId: d.data.slateTriggerBindingId,
      externalKey: d.data.externalKey ?? null,
      status: d.data.status,
      lastErrorCode: d.data.lastErrorCode ?? null,
      lastErrorMessage: d.data.lastErrorMessage ?? null,
      lastSyncedAt: d.data.lastSyncedAt
    },
    update: {
      slateTriggerBindingId: d.data.slateTriggerBindingId,
      externalKey: d.data.externalKey ?? null,
      status: d.data.status,
      lastErrorCode: d.data.lastErrorCode ?? null,
      lastErrorMessage: d.data.lastErrorMessage ?? null,
      lastSyncedAt: d.data.lastSyncedAt
    }
  });
};

export let detachRegistration = async (d: {
  registrationOid: bigint;
  slateTriggerBindingId: string;
  callbackOid: bigint;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerBindingId) {
      await slates.slateTriggerBinding.delete({
        tenantId: d.slatesTenantId,
        slateTriggerBindingId: d.slateTriggerBindingId
      });
    }
  } catch {}

  await db.callbackReceiverRegistration.updateMany({
    where: {
      oid: d.registrationOid,
      callbackOid: d.callbackOid
    },
    data: {
      status: CallbackReceiverRegistrationStatus.detached,
      lastSyncedAt: new Date()
    }
  });
};
