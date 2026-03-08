import { CallbackReceiverRegistrationStatus, CallbackStatus, db } from '@metorial-subspace/db';
import { slates } from '@metorial-subspace/provider-slates/src/client';
import {
  getActiveDestinationIds,
  getPair,
  getTenantForSlatesCached,
  isCallbackSupported,
  isPairEligibleForCallback,
  loadCallback,
  loadSlateContextForCallback,
  matchSharedConfigTrigger
} from './context';
import { detachRegistration, upsertRegistration } from './registration';

export let syncSharedTriggerConfig = async (callbackId: string) => {
  let callback = await loadCallback(callbackId);
  if (!callback || !isCallbackSupported(callback)) {
    return { callback, sharedConfig: null as any };
  }

  let slatesTenant = await getTenantForSlatesCached(callback.tenant);
  let slateContext = await loadSlateContextForCallback(callback);
  let slateId = slateContext?.providerConfigVersion.slateInstance?.slate.id;
  let destinationIds = getActiveDestinationIds(callback);

  if (!callback.slateSharedTriggerConfigId && !slateId) {
    return { callback, sharedConfig: null as any };
  }

  let sharedConfig = callback.slateSharedTriggerConfigId
    ? await slates.slateSharedTriggerConfig.update({
        tenantId: slatesTenant.id,
        slateSharedTriggerConfigId: callback.slateSharedTriggerConfigId,
        name: callback.name,
        description: callback.description ?? undefined,
        status: callback.status === CallbackStatus.active ? 'active' : 'paused',
        destinationIds
      })
    : await slates.slateSharedTriggerConfig.create({
        tenantId: slatesTenant.id,
        slateId: slateId!,
        name: callback.name,
        description: callback.description ?? undefined,
        status: callback.status === CallbackStatus.active ? 'active' : 'paused',
        destinationIds
      });

  if (callback.slateSharedTriggerConfigId !== sharedConfig.id) {
    await db.callback.update({
      where: { oid: callback.oid },
      data: {
        slateSharedTriggerConfigId: sharedConfig.id
      }
    });
  }

  let currentConfig = sharedConfig;

  for (let callbackTrigger of callback.callbackTriggers) {
    let existing =
      (callbackTrigger.slateSharedTriggerConfigTriggerId
        ? currentConfig.triggers.find(
            trigger => trigger.id === callbackTrigger.slateSharedTriggerConfigTriggerId
          )
        : null) ?? matchSharedConfigTrigger(currentConfig, callbackTrigger);

    currentConfig = existing
      ? await slates.slateSharedTriggerConfig.triggerUpdate({
          tenantId: slatesTenant.id,
          slateSharedTriggerConfigTriggerId: existing.id,
          eventTypes: callbackTrigger.eventTypes,
          pollIntervalSecondsOverride: callback.pollIntervalSecondsOverride
        })
      : await slates.slateSharedTriggerConfig.triggerCreate({
          tenantId: slatesTenant.id,
          slateSharedTriggerConfigId: currentConfig.id,
          triggerId: callbackTrigger.providerTriggerId,
          eventTypes: callbackTrigger.eventTypes,
          pollIntervalSecondsOverride: callback.pollIntervalSecondsOverride
        });

    let resolved = matchSharedConfigTrigger(currentConfig, callbackTrigger);
    if (resolved && callbackTrigger.slateSharedTriggerConfigTriggerId !== resolved.id) {
      await db.callbackTrigger.update({
        where: { oid: callbackTrigger.oid },
        data: {
          slateSharedTriggerConfigTriggerId: resolved.id
        }
      });
    }
  }

  let refreshedCallback = await loadCallback(callbackId);
  if (!refreshedCallback) {
    return { callback: refreshedCallback, sharedConfig: currentConfig };
  }

  let staleTriggers = currentConfig.triggers.filter(
    trigger =>
      !refreshedCallback.callbackTriggers.some(
        callbackTrigger =>
          callbackTrigger.slateSharedTriggerConfigTriggerId === trigger.id ||
          callbackTrigger.providerTriggerKey === trigger.triggerKey
      )
  );

  for (let stale of staleTriggers) {
    currentConfig = await slates.slateSharedTriggerConfig.triggerDelete({
      tenantId: slatesTenant.id,
      slateSharedTriggerConfigTriggerId: stale.id
    });
  }

  return {
    callback: refreshedCallback,
    sharedConfig: currentConfig
  };
};

export let syncPairTrigger = async (d: {
  callbackId: string;
  pairId: string;
  callbackTriggerId: string;
}) => {
  let synced = await syncSharedTriggerConfig(d.callbackId);
  let callback = synced.callback;
  if (!callback) return;

  let slatesTenant = await getTenantForSlatesCached(callback.tenant);
  let callbackTrigger = callback.callbackTriggers.find(t => t.id === d.callbackTriggerId);
  let pair = await getPair(d.pairId);

  let registration = await db.callbackReceiverRegistration.findFirst({
    where: {
      callbackOid: callback.oid,
      callbackTrigger: {
        id: d.callbackTriggerId
      },
      providerDeploymentConfigPair: {
        id: d.pairId
      }
    }
  });

  if (
    !pair ||
    !callbackTrigger ||
    !isCallbackSupported(callback) ||
    !synced.sharedConfig ||
    !callbackTrigger.slateSharedTriggerConfigTriggerId
  ) {
    if (registration) {
      await detachRegistration({
        registrationOid: registration.oid,
        slateTriggerBindingId: registration.slateTriggerBindingId,
        callbackOid: callback.oid,
        slatesTenantId: slatesTenant.id
      });
    }
    return;
  }

  let isEligible = await isPairEligibleForCallback({
    callback,
    pairOid: pair.oid,
    deploymentOid: pair.providerDeploymentVersion.deploymentOid
  });
  if (!isEligible) {
    if (registration) {
      await detachRegistration({
        registrationOid: registration.oid,
        slateTriggerBindingId: registration.slateTriggerBindingId,
        callbackOid: callback.oid,
        slatesTenantId: slatesTenant.id
      });
    }
    return;
  }

  try {
    let slateInstanceId = pair.providerConfigVersion.slateInstance?.id;
    if (!slateInstanceId) {
      throw new Error('missing_receiver_requirements');
    }

    let authConfigId = pair.providerAuthConfigVersion?.slateAuthConfig?.id ?? null;
    let externalKey =
      registration?.externalKey ?? `callback:${callback.id}:${pair.id}:${callbackTrigger.id}`;

    let binding = await slates.slateTriggerBinding.upsert({
      tenantId: slatesTenant.id,
      slateSharedTriggerConfigTriggerId: callbackTrigger.slateSharedTriggerConfigTriggerId,
      slateInstanceId,
      authConfigId,
      externalKey
    });

    await upsertRegistration({
      callbackOid: callback.oid,
      providerDeploymentConfigPairOid: pair.oid,
      callbackTriggerOid: callbackTrigger.oid,
      data: {
        slateTriggerBindingId: binding.id,
        externalKey,
        status: CallbackReceiverRegistrationStatus.active,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastSyncedAt: new Date()
      }
    });
  } catch (error) {
    let message = error instanceof Error ? error.message : 'callback_reconcile_failed';

    await upsertRegistration({
      callbackOid: callback.oid,
      providerDeploymentConfigPairOid: pair.oid,
      callbackTriggerOid: callbackTrigger.oid,
      data: {
        slateTriggerBindingId: registration?.slateTriggerBindingId ?? '',
        externalKey: registration?.externalKey ?? null,
        status: CallbackReceiverRegistrationStatus.failed,
        lastErrorCode: 'callback_reconcile_failed',
        lastErrorMessage: message,
        lastSyncedAt: new Date()
      }
    });
  }
};
