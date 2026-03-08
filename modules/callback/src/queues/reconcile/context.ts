import { createLocallyCachedFunction } from '@lowerdeck/cache';
import {
  CallbackDestinationStatus,
  CallbackMode,
  CallbackStatus,
  db
} from '@metorial-subspace/db';
import { getTenantForSlates } from '@metorial-subspace/provider-slates/src/client';

export let callbackInclude = {
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
  callbackManualPairLinks: true,
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

export let loadCallback = async (callbackId: string) => {
  let callback = await loadCallbackCached(callbackId);
  if (!callback) callback = await loadCallbackUncached(callbackId);
  return callback;
};

export type LoadedCallback = NonNullable<Awaited<ReturnType<typeof loadCallback>>>;

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

export let getPair = async (pairId: string) => {
  let pair = await getPairCached(pairId);
  if (!pair) pair = await getPairUncached(pairId);
  return pair;
};

export let getTenantForSlatesCached = createLocallyCachedFunction({
  getHash: (tenant: { oid: bigint }) => tenant.oid.toString(),
  ttlSeconds: 60,
  provider: getTenantForSlates
});

export let isCallbackSupported = (callback: LoadedCallback) =>
  callback.status === CallbackStatus.active &&
  callback.providerDeployment.provider.type.attributes.backend === 'slates' &&
  callback.providerDeployment.provider.type.attributes.triggers.status === 'enabled';

export let getActiveDestinationIds = (callback: LoadedCallback) =>
  callback.callbackDestinationLinks
    .filter(link => link.callbackDestination.status === CallbackDestinationStatus.active)
    .map(link => link.callbackDestination.slateTriggerDestinationId);

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

export let isPairEligibleForCallback = async (d: {
  callback: LoadedCallback;
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

export let getPairQueryForCallback = (callback: LoadedCallback) =>
  callback.mode === CallbackMode.auto
    ? {
        providerDeploymentVersion: {
          deploymentOid: callback.providerDeploymentOid
        }
      }
    : {
        callbackManualPairLinks: {
          some: {
            callbackOid: callback.oid
          }
        }
      };

export let loadSlateContextForCallback = async (callback: LoadedCallback) =>
  await db.providerDeploymentConfigPair.findFirst({
    where: getPairQueryForCallback(callback),
    orderBy: { id: 'asc' },
    select: {
      providerConfigVersion: {
        select: {
          slateInstance: {
            select: {
              id: true,
              slate: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      }
    }
  });

export let matchSharedConfigTrigger = (
  config: {
    triggers: {
      id: string;
      triggerId: string;
      triggerKey: string;
    }[];
  },
  callbackTrigger: {
    providerTriggerId: string;
    providerTriggerKey: string;
  }
) =>
  config.triggers.find(
    trigger =>
      trigger.id === callbackTrigger.providerTriggerId ||
      trigger.triggerId === callbackTrigger.providerTriggerId ||
      trigger.triggerKey === callbackTrigger.providerTriggerKey
  ) ?? null;
