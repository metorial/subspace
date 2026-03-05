import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  CallbackDestinationStatus,
  CallbackMode,
  CallbackReceiverRegistrationStatus,
  CallbackStatus,
  db,
  getId
} from '@metorial-subspace/db';
import { callbackRegistrationReconcileQueue as callbackReconcileQueue } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { env } from '../env';

export { callbackReconcileQueue };

let PAIR_PAGE_SIZE = 100;
let REGISTRATION_PAGE_SIZE = 100;

let callbackInclude = {
  tenant: true,
  providerDeployment: {
    include: {
      provider: {
        include: {
          type: true
        }
      }
    }
  },
  callbackTriggers: true,
  callbackDestinationLinks: {
    include: {
      callbackDestination: true
    }
  }
};

let pairInclude = {
  providerDeploymentVersion: {
    include: {
      deployment: true
    }
  },
  providerConfigVersion: {
    include: {
      slateInstance: true
    }
  },
  providerAuthConfigVersion: {
    include: {
      slateAuthConfig: true
    }
  }
};

let isCallbackSupported = (callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>) =>
  callback.status === CallbackStatus.active &&
  callback.providerDeployment.provider.type.attributes.backend === 'slates' &&
  callback.providerDeployment.provider.type.attributes.triggers.status === 'enabled';

let getActiveDestinationIds = (
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>
) =>
  callback.callbackDestinationLinks
    .filter(link => link.callbackDestination.status === CallbackDestinationStatus.active)
    .map(link => link.callbackDestination.slateTriggerDestinationId);

let loadCallbackUncached = async (callbackId: string) =>
  db.callback.findFirst({
    where: { id: callbackId },
    include: callbackInclude
  });

let loadCallbackCached = createLocallyCachedFunction({
  getHash: (callbackId: string) => callbackId,
  ttlSeconds: 5,
  provider: loadCallbackUncached
});

let loadCallback = async (callbackId: string) => {
  let callback = await loadCallbackCached(callbackId);
  if (!callback) callback = await loadCallbackUncached(callbackId);
  return callback;
};

let getTenantForSlatesCached = createLocallyCachedFunction({
  getHash: (tenant: { oid: bigint }) => tenant.oid.toString(),
  ttlSeconds: 60,
  provider: getTenantForSlates
});

let getPairUncached = async (pairId: string) =>
  db.providerDeploymentConfigPair.findFirst({
    where: { id: pairId },
    include: pairInclude
  });

let getPairCached = createLocallyCachedFunction({
  getHash: (pairId: string) => pairId,
  ttlSeconds: 15,
  provider: getPairUncached
});

let getPair = async (pairId: string) => {
  let pair = await getPairCached(pairId);
  if (!pair) pair = await getPairUncached(pairId);
  return pair;
};

let upsertRegistration = async (d: {
  callbackOid: bigint;
  providerDeploymentConfigPairOid: bigint;
  callbackTriggerOid: bigint;
  data: {
    slateTriggerReceiverId: string;
    slateTriggerReceiverTriggerId: string;
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
      slateTriggerReceiverId: d.data.slateTriggerReceiverId,
      slateTriggerReceiverTriggerId: d.data.slateTriggerReceiverTriggerId,
      status: d.data.status,
      lastErrorCode: d.data.lastErrorCode ?? null,
      lastErrorMessage: d.data.lastErrorMessage ?? null,
      lastSyncedAt: d.data.lastSyncedAt
    },
    update: {
      slateTriggerReceiverId: d.data.slateTriggerReceiverId,
      slateTriggerReceiverTriggerId: d.data.slateTriggerReceiverTriggerId,
      status: d.data.status,
      lastErrorCode: d.data.lastErrorCode ?? null,
      lastErrorMessage: d.data.lastErrorMessage ?? null,
      lastSyncedAt: d.data.lastSyncedAt
    }
  });
};

let detachRegistration = async (d: {
  registrationOid: bigint;
  slateTriggerReceiverId: string;
  callbackOid: bigint;
  slatesTenantId: string;
}) => {
  try {
    if (d.slateTriggerReceiverId) {
      await slates.slateTriggerReceiver.delete({
        tenantId: d.slatesTenantId,
        slateTriggerReceiverId: d.slateTriggerReceiverId
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

let isPairEligibleForCallback = async (d: {
  callback: NonNullable<Awaited<ReturnType<typeof loadCallback>>>;
  pairOid: bigint;
  deploymentOid: bigint;
}) => {
  if (d.callback.mode === CallbackMode.auto) {
    return d.deploymentOid === d.callback.providerDeploymentOid;
  }

  let manual = await getManualLinkCached({
    callbackOid: d.callback.oid,
    pairOid: d.pairOid
  });
  if (!manual) {
    manual = await db.callbackManualPairLink.findFirst({
      where: {
        callbackOid: d.callback.oid,
        providerDeploymentConfigPairOid: d.pairOid
      },
      select: { oid: true }
    });
  }
  return !!manual;
};

let getManualLinkCached = createLocallyCachedFunction({
  getHash: (d: { callbackOid: bigint; pairOid: bigint }) =>
    `${d.callbackOid.toString()}:${d.pairOid.toString()}`,
  ttlSeconds: 15,
  provider: async (d: { callbackOid: bigint; pairOid: bigint }) =>
    await db.callbackManualPairLink.findFirst({
      where: {
        callbackOid: d.callbackOid,
        providerDeploymentConfigPairOid: d.pairOid
      },
      select: { oid: true }
    })
});

let syncPairTrigger = async (d: {
  callbackId: string;
  pairId: string;
  callbackTriggerId: string;
}) => {
  let callback = await loadCallback(d.callbackId);
  if (!callback) return;

  let slatesTenant = await getTenantForSlatesCached(callback.tenant);

  let callbackTrigger = callback.callbackTriggers.find(t => t.id === d.callbackTriggerId);
  let destinationIds = getActiveDestinationIds(callback);

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

  if (!pair || !callbackTrigger || !isCallbackSupported(callback) || !destinationIds.length) {
    if (registration) {
      await detachRegistration({
        registrationOid: registration.oid,
        slateTriggerReceiverId: registration.slateTriggerReceiverId,
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
        slateTriggerReceiverId: registration.slateTriggerReceiverId,
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
    let triggerInput = {
      triggerId: callbackTrigger.providerTriggerId,
      ...(callback.pollIntervalSecondsOverride !== null &&
      callback.pollIntervalSecondsOverride !== undefined
        ? { pollIntervalSeconds: callback.pollIntervalSecondsOverride }
        : {})
    };

    let receiver = registration
      ? await slates.slateTriggerReceiver.update({
          tenantId: slatesTenant.id,
          slateTriggerReceiverId: registration.slateTriggerReceiverId,
          authConfigId,
          destinations: destinationIds,
          triggers: [triggerInput],
          eventTypes: callbackTrigger.eventTypes
        })
      : await slates.slateTriggerReceiver.create({
          tenantId: slatesTenant.id,
          slateInstanceId,
          authConfigId: authConfigId ?? undefined,
          destinations: destinationIds,
          triggers: [triggerInput],
          eventTypes: callbackTrigger.eventTypes,
          name: `Callback ${callback.id} / ${callbackTrigger.providerTriggerKey}`
        });

    let receiverTrigger = receiver.triggers[0];
    if (!receiverTrigger) throw new Error('receiver_trigger_missing');

    await upsertRegistration({
      callbackOid: callback.oid,
      providerDeploymentConfigPairOid: pair.oid,
      callbackTriggerOid: callbackTrigger.oid,
      data: {
        slateTriggerReceiverId: receiver.id,
        slateTriggerReceiverTriggerId: receiverTrigger.id,
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
        slateTriggerReceiverId: registration?.slateTriggerReceiverId ?? '',
        slateTriggerReceiverTriggerId: registration?.slateTriggerReceiverTriggerId ?? '',
        status: CallbackReceiverRegistrationStatus.failed,
        lastErrorCode: 'callback_reconcile_failed',
        lastErrorMessage: message,
        lastSyncedAt: new Date()
      }
    });
  }
};

let callbackReconcilePairQueue = createQueue<{
  callbackId: string;
  providerDeploymentConfigPairId: string;
}>({
  name: 'sub/callback/reconcile/pair',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

let callbackReconcilePairsPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/pairs/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

let callbackReconcilePairTriggerQueue = createQueue<{
  callbackId: string;
  pairId: string;
  callbackTriggerId: string;
}>({
  name: 'sub/callback/reconcile/pair-trigger',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 30,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

let callbackReconcilePairRegistrationsPageQueue = createQueue<{
  callbackId: string;
  providerDeploymentConfigPairId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/pair/registrations/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 5
  }
});

let callbackReconcileRegistrationsPageQueue = createQueue<{
  callbackId: string;
  cursor?: string;
}>({
  name: 'sub/callback/reconcile/registrations/page',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

let callbackReconcileRegistrationAuditQueue = createQueue<{
  registrationId: string;
}>({
  name: 'sub/callback/reconcile/registration/audit',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

export let callbackReconcileQueueProcessor = callbackReconcileQueue.process(async data => {
  if (data.callbackId && data.providerDeploymentConfigPairId) {
    await callbackReconcilePairQueue.add({
      callbackId: data.callbackId,
      providerDeploymentConfigPairId: data.providerDeploymentConfigPairId
    });
    return;
  }

  if (data.callbackId) {
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

    let pairs =
      callback.mode === CallbackMode.auto
        ? await db.providerDeploymentConfigPair.findMany({
            where: {
              providerDeploymentVersion: {
                deploymentOid: callback.providerDeploymentOid
              },
              id: data.cursor ? { gt: data.cursor } : undefined
            },
            orderBy: { id: 'asc' },
            take: PAIR_PAGE_SIZE,
            select: { id: true }
          })
        : await db.providerDeploymentConfigPair.findMany({
            where: {
              callbackManualPairLinks: {
                some: { callbackOid: callback.oid }
              },
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
    let destinationIds = getActiveDestinationIds(callback);
    let supported = isCallbackSupported(callback) && destinationIds.length > 0;
    let isEligible = await isPairEligibleForCallback({
      callback,
      pairOid: registration.providerDeploymentConfigPairOid,
      deploymentOid:
        registration.providerDeploymentConfigPair.providerDeploymentVersion.deploymentOid
    });

    if (!supported || !isEligible) {
      await detachRegistration({
        registrationOid: registration.oid,
        slateTriggerReceiverId: registration.slateTriggerReceiverId,
        callbackOid: callback.oid,
        slatesTenantId: slatesTenant.id
      });
    }
  });
