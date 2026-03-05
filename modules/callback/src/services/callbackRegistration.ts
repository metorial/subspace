import { Service } from '@lowerdeck/service';
import {
  CallbackMode,
  CallbackReceiverRegistrationStatus,
  CallbackStatus,
  CallbackDestinationStatus,
  db,
  getId
} from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { callbackRegistrationReconcileQueue } from '../queues/reconcile';

const callbackInclude = {
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
  },
  callbackManualPairLinks: true
};

const pairInclude = {
  providerDeploymentVersion: {
    include: {
      deployment: true
    }
  },
  providerConfigVersion: {
    include: {
      config: true,
      slateInstance: true
    }
  },
  providerAuthConfigVersion: {
    include: {
      authConfig: true,
      slateAuthConfig: true
    }
  }
};

class callbackRegistrationServiceImpl {
  private async upsertRegistration(d: {
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
  }) {
    let newId = getId('callbackReceiverRegistration');
    let registration = await db.callbackReceiverRegistration.upsert({
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

    return {
      registration,
      wasCreated: registration.id === newId.id
    };
  }

  async enqueueReconcile(d: { callbackId?: string; providerDeploymentConfigPairId?: string }) {
    await callbackRegistrationReconcileQueue.add(d);
  }

  async reconcileForPair(d: { providerDeploymentConfigPairId: string }) {
    let pair = await db.providerDeploymentConfigPair.findFirst({
      where: { id: d.providerDeploymentConfigPairId },
      include: pairInclude
    });
    if (!pair) return;

    let deploymentOid = pair.providerDeploymentVersion.deploymentOid;

    let callbacks = await db.callback.findMany({
      where: {
        status: CallbackStatus.active,
        OR: [
          {
            mode: CallbackMode.auto,
            providerDeploymentOid: deploymentOid
          },
          {
            mode: CallbackMode.manual,
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

    await Promise.all(callbacks.map(callback => this.reconcileCallback({ callbackId: callback.id })));
  }

  async reconcileCallback(d: { callbackId: string }) {
    let callback = await db.callback.findFirst({
      where: { id: d.callbackId },
      include: callbackInclude
    });
    if (!callback) return;

    let slatesTenant = await getTenantForSlates(callback.tenant);

    let existingRegistrations = await db.callbackReceiverRegistration.findMany({
      where: { callbackOid: callback.oid }
    });

    if (callback.status !== CallbackStatus.active || callback.callbackTriggers.length === 0) {
      await this.detachRegistrations(existingRegistrations, callback.oid, slatesTenant.id);
      return;
    }

    if (
      callback.providerDeployment.provider.type.attributes.backend !== 'slates' ||
      callback.providerDeployment.provider.type.attributes.triggers.status !== 'enabled'
    ) {
      await this.detachRegistrations(existingRegistrations, callback.oid, slatesTenant.id);
      return;
    }

    let pairs =
      callback.mode === CallbackMode.auto
        ? await db.providerDeploymentConfigPair.findMany({
            where: {
              providerDeploymentVersion: {
                deploymentOid: callback.providerDeploymentOid
              }
            },
            include: pairInclude
          })
        : await db.providerDeploymentConfigPair.findMany({
            where: {
              callbackManualPairLinks: {
                some: {
                  callbackOid: callback.oid
                }
              }
            },
            include: pairInclude
          });

    let destinationIds = callback.callbackDestinationLinks
      .filter(link => link.callbackDestination.status === CallbackDestinationStatus.active)
      .map(link => link.callbackDestination.slateTriggerDestinationId);

    if (!destinationIds.length) {
      await this.detachRegistrations(existingRegistrations, callback.oid, slatesTenant.id);
      return;
    }

    let targetKeys = new Set<string>();

    for (let pair of pairs) {
      for (let trigger of callback.callbackTriggers) {
        let key = `${pair.oid.toString()}:${trigger.oid.toString()}`;
        targetKeys.add(key);

        let existing = existingRegistrations.find(
          reg =>
            reg.providerDeploymentConfigPairOid === pair.oid &&
            reg.callbackTriggerOid === trigger.oid
        );

        try {
          let slateInstanceId = pair.providerConfigVersion.slateInstance?.id;
          if (!slateInstanceId) {
            throw new Error('missing_receiver_requirements');
          }

          let authConfigId = pair.providerAuthConfigVersion?.slateAuthConfig?.id ?? null;
          let triggerInput = {
            triggerId: trigger.providerTriggerId,
            ...(callback.pollIntervalSecondsOverride !== null &&
            callback.pollIntervalSecondsOverride !== undefined
              ? { pollIntervalSeconds: callback.pollIntervalSecondsOverride }
              : {})
          } as any;

          let receiver = existing
            ? await (slates.slateTriggerReceiver.update as any)({
                tenantId: slatesTenant.id,
                slateTriggerReceiverId: existing.slateTriggerReceiverId,
                authConfigId,
                destinations: destinationIds,
                triggers: [triggerInput],
                eventTypes: trigger.eventTypes
              })
            : await (slates.slateTriggerReceiver.create as any)({
                tenantId: slatesTenant.id,
                slateInstanceId,
                authConfigId: authConfigId ?? undefined,
                destinations: destinationIds,
                triggers: [triggerInput],
                eventTypes: trigger.eventTypes,
                name: `Callback ${callback.id} / ${trigger.providerTriggerKey}`
              });

          let receiverTrigger = receiver.triggers[0];
          if (!receiverTrigger) {
            throw new Error('receiver_trigger_missing');
          }

          await this.upsertRegistration({
            callbackOid: callback.oid,
            providerDeploymentConfigPairOid: pair.oid,
            callbackTriggerOid: trigger.oid,
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

          await this.upsertRegistration({
            callbackOid: callback.oid,
            providerDeploymentConfigPairOid: pair.oid,
            callbackTriggerOid: trigger.oid,
            data: {
              slateTriggerReceiverId: existing?.slateTriggerReceiverId ?? '',
              slateTriggerReceiverTriggerId: existing?.slateTriggerReceiverTriggerId ?? '',
              status: CallbackReceiverRegistrationStatus.failed,
              lastErrorCode: 'callback_reconcile_failed',
              lastErrorMessage: message,
              lastSyncedAt: new Date()
            }
          });
        }
      }
    }

    let stale = existingRegistrations.filter(
      reg => !targetKeys.has(`${reg.providerDeploymentConfigPairOid.toString()}:${reg.callbackTriggerOid.toString()}`)
    );

    await this.detachRegistrations(stale, callback.oid, slatesTenant.id);
  }

  private async detachRegistrations(
    registrations: {
      oid: bigint;
      slateTriggerReceiverId: string;
      status: CallbackReceiverRegistrationStatus;
    }[],
    callbackOid: bigint,
    slatesTenantId: string
  ) {
    for (let registration of registrations) {
      try {
        if (registration.slateTriggerReceiverId) {
          await slates.slateTriggerReceiver.delete({
            tenantId: slatesTenantId,
            slateTriggerReceiverId: registration.slateTriggerReceiverId
          });
        }
      } catch {}

      await db.callbackReceiverRegistration.updateMany({
        where: {
          oid: registration.oid,
          callbackOid
        },
        data: {
          status: CallbackReceiverRegistrationStatus.detached,
          lastSyncedAt: new Date()
        }
      });
    }
  }
}

export let callbackRegistrationService = Service.create(
  'callbackRegistrationService',
  () => new callbackRegistrationServiceImpl()
).build();
