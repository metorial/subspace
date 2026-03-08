import { QueueRetryError } from '@lowerdeck/queue';
import { CallbackMode, CallbackStatus, db } from '@metorial-subspace/db';
import { getTenantForSlates } from '@metorial-subspace/provider-slates/src/client';
import { PAIR_PAGE_SIZE, REGISTRATION_PAGE_SIZE } from './constants';
import {
  callbackInclude,
  getActiveDestinationIds,
  getPairQueryForCallback,
  isCallbackSupported,
  isPairEligibleForCallback,
  loadCallback
} from './context';
import {
  callbackReconcilePairQueue,
  callbackReconcilePairRegistrationsPageQueue,
  callbackReconcilePairsPageQueue,
  callbackReconcilePairTriggerQueue,
  callbackReconcileQueue,
  callbackReconcileRegistrationAuditQueue,
  callbackReconcileRegistrationsPageQueue,
  callbackSharedTriggerConfigSyncQueue
} from './queueDefs';
import { detachRegistration } from './registration';
import { syncPairTrigger, syncSharedTriggerConfig } from './sync';

export let callbackReconcileQueueProcessor = callbackReconcileQueue.process(async data => {
  if (data.callbackId && data.scope === 'config') {
    await callbackSharedTriggerConfigSyncQueue.add({
      callbackId: data.callbackId
    });
    return;
  }

  if (data.callbackId && data.providerDeploymentConfigPairId) {
    if (data.scope !== 'bindings') {
      await callbackSharedTriggerConfigSyncQueue.add({
        callbackId: data.callbackId
      });
    }
    await callbackReconcilePairQueue.add({
      callbackId: data.callbackId,
      providerDeploymentConfigPairId: data.providerDeploymentConfigPairId
    });
    return;
  }

  if (data.callbackId) {
    if (data.scope !== 'bindings') {
      await callbackSharedTriggerConfigSyncQueue.add({ callbackId: data.callbackId });
    }
    if (data.scope === 'config') return;
    await callbackReconcilePairsPageQueue.add({ callbackId: data.callbackId });
    await callbackReconcileRegistrationsPageQueue.add({ callbackId: data.callbackId });
    return;
  }

  if (data.providerDeploymentConfigPairId) {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: data.providerDeploymentConfigPairId },
      select: {
        oid: true,
        providerDeploymentVersion: {
          select: {
            deploymentOid: true
          }
        }
      }
    });
    if (!pair) return;

    let callbacks = await db.callback.findMany({
      where: {
        status: CallbackStatus.active,
        OR: [
          {
            mode: CallbackMode.auto,
            providerDeploymentOid: pair.providerDeploymentVersion.deploymentOid
          },
          {
            callbackManualPairLinks: {
              some: {
                providerDeploymentConfigPairOid: pair.oid
              }
            }
          }
        ]
      },
      select: { id: true }
    });
    if (!callbacks.length) return;

    await callbackReconcilePairQueue.addManyWithOps(
      callbacks.map(callback => ({
        data: {
          callbackId: callback.id,
          providerDeploymentConfigPairId: data.providerDeploymentConfigPairId!
        },
        opts: { id: `cb:${callback.id}:${data.providerDeploymentConfigPairId}` }
      }))
    );
    return;
  }

  throw new QueueRetryError();
});

export let callbackReconcilePairQueueProcessor = callbackReconcilePairQueue.process(
  async data => {
    let callback = await loadCallback(data.callbackId);
    if (!callback) return;

    if (!callback.callbackTriggers.length) {
      await callbackReconcilePairRegistrationsPageQueue.add({
        callbackId: callback.id,
        providerDeploymentConfigPairId: data.providerDeploymentConfigPairId
      });
      return;
    }

    await callbackReconcilePairTriggerQueue.addManyWithOps(
      callback.callbackTriggers.map(trigger => ({
        data: {
          callbackId: callback.id,
          pairId: data.providerDeploymentConfigPairId,
          callbackTriggerId: trigger.id
        },
        opts: {
          id: `${callback.id}:${data.providerDeploymentConfigPairId}:${trigger.id}`
        }
      }))
    );

    await callbackReconcilePairRegistrationsPageQueue.add({
      callbackId: callback.id,
      providerDeploymentConfigPairId: data.providerDeploymentConfigPairId
    });
  }
);

export let callbackSharedTriggerConfigSyncQueueProcessor =
  callbackSharedTriggerConfigSyncQueue.process(async data => {
    await syncSharedTriggerConfig(data.callbackId);
  });

export let callbackReconcilePairsPageQueueProcessor = callbackReconcilePairsPageQueue.process(
  async data => {
    let callback = await loadCallback(data.callbackId);
    if (!callback) return;

    if (!isCallbackSupported(callback) || callback.callbackTriggers.length === 0) {
      return;
    }

    if (getActiveDestinationIds(callback).length === 0) {
      return;
    }

    let pairs = await db.providerDeploymentConfigPair.findMany({
      where: {
        ...getPairQueryForCallback(callback),
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: PAIR_PAGE_SIZE,
      select: { id: true }
    });

    if (!pairs.length) return;

    await callbackReconcilePairTriggerQueue.addManyWithOps(
      pairs.flatMap(pair =>
        callback.callbackTriggers.map(trigger => ({
          data: {
            callbackId: callback.id,
            pairId: pair.id,
            callbackTriggerId: trigger.id
          },
          opts: {
            id: `${callback.id}:${pair.id}:${trigger.id}`
          }
        }))
      )
    );

    if (pairs.length === PAIR_PAGE_SIZE) {
      await callbackReconcilePairsPageQueue.add({
        callbackId: callback.id,
        cursor: pairs[pairs.length - 1]!.id
      });
    }
  }
);

export let callbackReconcilePairTriggerQueueProcessor =
  callbackReconcilePairTriggerQueue.process(async data => {
    await syncPairTrigger(data);
  });

export let callbackReconcilePairRegistrationsPageQueueProcessor =
  callbackReconcilePairRegistrationsPageQueue.process(async data => {
    let rows = await db.callbackReceiverRegistration.findMany({
      where: {
        callback: {
          id: data.callbackId
        },
        providerDeploymentConfigPair: {
          id: data.providerDeploymentConfigPairId
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: REGISTRATION_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    await callbackReconcileRegistrationAuditQueue.addManyWithOps(
      rows.map(row => ({
        data: { registrationId: row.id },
        opts: { id: row.id }
      }))
    );

    if (rows.length === REGISTRATION_PAGE_SIZE) {
      await callbackReconcilePairRegistrationsPageQueue.add({
        callbackId: data.callbackId,
        providerDeploymentConfigPairId: data.providerDeploymentConfigPairId,
        cursor: rows[rows.length - 1]!.id
      });
    }
  });

export let callbackReconcileRegistrationsPageQueueProcessor =
  callbackReconcileRegistrationsPageQueue.process(async data => {
    let rows = await db.callbackReceiverRegistration.findMany({
      where: {
        callback: {
          id: data.callbackId
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: REGISTRATION_PAGE_SIZE,
      select: { id: true }
    });
    if (!rows.length) return;

    await callbackReconcileRegistrationAuditQueue.addManyWithOps(
      rows.map(row => ({
        data: { registrationId: row.id },
        opts: { id: row.id }
      }))
    );

    if (rows.length === REGISTRATION_PAGE_SIZE) {
      await callbackReconcileRegistrationsPageQueue.add({
        callbackId: data.callbackId,
        cursor: rows[rows.length - 1]!.id
      });
    }
  });

export let callbackReconcileRegistrationAuditQueueProcessor =
  callbackReconcileRegistrationAuditQueue.process(async data => {
    let registration = await db.callbackReceiverRegistration.findFirst({
      where: { id: data.registrationId },
      include: {
        callback: {
          include: callbackInclude
        },
        callbackTrigger: true,
        providerDeploymentConfigPair: {
          include: {
            providerDeploymentVersion: {
              select: { deploymentOid: true }
            }
          }
        }
      }
    });
    if (!registration) return;

    let callback = registration.callback;
    let slatesTenant = await getTenantForSlates(callback.tenant);
    let supported =
      isCallbackSupported(callback) &&
      !!callback.slateSharedTriggerConfigId &&
      !!registration.callbackTrigger.slateSharedTriggerConfigTriggerId;
    let isEligible = await isPairEligibleForCallback({
      callback,
      pairOid: registration.providerDeploymentConfigPairOid,
      deploymentOid:
        registration.providerDeploymentConfigPair.providerDeploymentVersion.deploymentOid
    });

    if (!supported || !isEligible) {
      await detachRegistration({
        registrationOid: registration.oid,
        slateTriggerBindingId: registration.slateTriggerBindingId,
        callbackOid: callback.oid,
        slatesTenantId: slatesTenant.id
      });
    }
  });
