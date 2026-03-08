import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://localhost/test';
process.env.PUBLIC_SERVICE_URL ??= 'http://localhost:3000';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SLATES_HUB_URL ??= 'http://localhost:4000';
process.env.SLATES_HUB_PUBLIC_URL ??= 'http://localhost:4000';

const mocks = vi.hoisted(() => ({
  db: {
    callback: {
      update: vi.fn()
    },
    callbackTrigger: {
      update: vi.fn()
    },
    callbackReceiverRegistration: {
      findFirst: vi.fn()
    }
  },
  slates: {
    slateSharedTriggerConfig: {
      create: vi.fn(),
      update: vi.fn(),
      triggerCreate: vi.fn(),
      triggerUpdate: vi.fn(),
      triggerDelete: vi.fn()
    },
    slateTriggerBinding: {
      upsert: vi.fn()
    }
  },
  context: {
    getActiveDestinationIds: vi.fn(),
    getPair: vi.fn(),
    getTenantForSlatesCached: vi.fn(),
    isCallbackSupported: vi.fn(),
    isPairEligibleForCallback: vi.fn(),
    loadCallback: vi.fn(),
    loadSlateContextForCallback: vi.fn(),
    matchSharedConfigTrigger: vi.fn()
  },
  registration: {
    detachRegistration: vi.fn(),
    upsertRegistration: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  CallbackReceiverRegistrationStatus: {
    active: 'active',
    failed: 'failed'
  },
  CallbackStatus: {
    active: 'active'
  },
  db: mocks.db
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  slates: mocks.slates
}));

vi.mock('./context', () => mocks.context);
vi.mock('./registration', () => mocks.registration);

import { syncPairTrigger, syncSharedTriggerConfig } from './sync';

describe('callback reconcile sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a shared trigger config and syncs callback triggers into slates', async () => {
    let callback = {
      id: 'callback-1',
      oid: 1n,
      tenant: { oid: 10n },
      name: 'Orders callback',
      description: 'Shared trigger config',
      status: 'active',
      slateSharedTriggerConfigId: null,
      callbackTriggers: [
        {
          oid: 101n,
          id: 'callback-trigger-1',
          providerTriggerId: 'provider-trigger-1',
          providerTriggerKey: 'order.created',
          eventTypes: ['order.created'],
          slateSharedTriggerConfigTriggerId: null
        },
        {
          oid: 102n,
          id: 'callback-trigger-2',
          providerTriggerId: 'provider-trigger-2',
          providerTriggerKey: 'order.updated',
          eventTypes: ['order.updated'],
          slateSharedTriggerConfigTriggerId: null
        }
      ]
    };

    mocks.context.loadCallback
      .mockResolvedValueOnce(callback)
      .mockResolvedValueOnce({
        ...callback,
        slateSharedTriggerConfigId: 'shared-config-1',
        callbackTriggers: [
          {
            ...callback.callbackTriggers[0],
            slateSharedTriggerConfigTriggerId: 'shared-trigger-1'
          },
          {
            ...callback.callbackTriggers[1],
            slateSharedTriggerConfigTriggerId: 'shared-trigger-2'
          }
        ]
      });
    mocks.context.isCallbackSupported.mockReturnValue(true);
    mocks.context.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    mocks.context.loadSlateContextForCallback.mockResolvedValue({
      providerConfigVersion: {
        slateInstance: {
          slate: {
            id: 'slate-1'
          }
        }
      }
    });
    mocks.context.getActiveDestinationIds.mockReturnValue(['dest-1']);
    mocks.context.matchSharedConfigTrigger.mockImplementation((config, callbackTrigger) => {
      return (
        config.triggers.find((trigger: { triggerKey: string }) => {
          return trigger.triggerKey === callbackTrigger.providerTriggerKey;
        }) ?? null
      );
    });

    mocks.slates.slateSharedTriggerConfig.create.mockResolvedValue({
      id: 'shared-config-1',
      triggers: []
    });
    mocks.slates.slateSharedTriggerConfig.triggerCreate
      .mockResolvedValueOnce({
        id: 'shared-config-1',
        triggers: [
          {
            id: 'shared-trigger-1',
            triggerId: 'provider-trigger-1',
            triggerKey: 'order.created'
          }
        ]
      })
      .mockResolvedValueOnce({
        id: 'shared-config-1',
        triggers: [
          {
            id: 'shared-trigger-1',
            triggerId: 'provider-trigger-1',
            triggerKey: 'order.created'
          },
          {
            id: 'shared-trigger-2',
            triggerId: 'provider-trigger-2',
            triggerKey: 'order.updated'
          }
        ]
      });

    let result = await syncSharedTriggerConfig('callback-1');

    expect(mocks.slates.slateSharedTriggerConfig.create).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      slateId: 'slate-1',
      name: 'Orders callback',
      description: 'Shared trigger config',
      status: 'active',
      destinationIds: ['dest-1']
    });
    expect(mocks.db.callback.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: {
        slateSharedTriggerConfigId: 'shared-config-1'
      }
    });
    expect(mocks.db.callbackTrigger.update).toHaveBeenCalledTimes(2);
    expect(mocks.slates.slateSharedTriggerConfig.triggerCreate).toHaveBeenCalledTimes(2);
    expect(result.sharedConfig.id).toBe('shared-config-1');
    expect(result.sharedConfig.triggers).toHaveLength(2);
  });

  it('upserts one binding for an eligible callback trigger and stores the registration', async () => {
    let callback = {
      id: 'callback-1',
      oid: 1n,
      tenant: { oid: 10n },
      name: 'Orders callback',
      description: null,
      status: 'active',
      providerDeploymentOid: 200n,
      slateSharedTriggerConfigId: 'shared-config-1',
      callbackTriggers: [
        {
          oid: 101n,
          id: 'callback-trigger-1',
          providerTriggerId: 'provider-trigger-1',
          providerTriggerKey: 'order.created',
          eventTypes: ['order.created'],
          slateSharedTriggerConfigTriggerId: 'shared-trigger-1'
        }
      ]
    };

    mocks.context.loadCallback
      .mockResolvedValueOnce(callback)
      .mockResolvedValueOnce(callback);
    mocks.context.isCallbackSupported.mockReturnValue(true);
    mocks.context.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    mocks.context.loadSlateContextForCallback.mockResolvedValue({
      providerConfigVersion: {
        slateInstance: {
          slate: {
            id: 'slate-1'
          }
        }
      }
    });
    mocks.context.getActiveDestinationIds.mockReturnValue(['dest-1']);
    mocks.context.matchSharedConfigTrigger.mockImplementation((config, callbackTrigger) => {
      return (
        config.triggers.find((trigger: { id: string }) => {
          return trigger.id === callbackTrigger.slateSharedTriggerConfigTriggerId;
        }) ?? null
      );
    });
    mocks.context.getPair.mockResolvedValue({
      id: 'pair-1',
      oid: 300n,
      providerDeploymentVersion: {
        deploymentOid: 200n
      },
      providerConfigVersion: {
        slateInstance: {
          id: 'instance-1'
        }
      },
      providerAuthConfigVersion: {
        slateAuthConfig: {
          id: 'auth-1'
        }
      }
    });
    mocks.context.isPairEligibleForCallback.mockResolvedValue(true);
    mocks.db.callbackReceiverRegistration.findFirst.mockResolvedValue(null);

    mocks.slates.slateSharedTriggerConfig.update.mockResolvedValue({
      id: 'shared-config-1',
      triggers: [
        {
          id: 'shared-trigger-1',
          triggerId: 'provider-trigger-1',
          triggerKey: 'order.created'
        }
      ]
    });
    mocks.slates.slateSharedTriggerConfig.triggerUpdate.mockResolvedValue({
      id: 'shared-config-1',
      triggers: [
        {
          id: 'shared-trigger-1',
          triggerId: 'provider-trigger-1',
          triggerKey: 'order.created'
        }
      ]
    });
    mocks.slates.slateTriggerBinding.upsert.mockResolvedValue({
      id: 'binding-1'
    });

    await syncPairTrigger({
      callbackId: 'callback-1',
      pairId: 'pair-1',
      callbackTriggerId: 'callback-trigger-1'
    });

    expect(mocks.slates.slateTriggerBinding.upsert).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      slateSharedTriggerConfigTriggerId: 'shared-trigger-1',
      slateInstanceId: 'instance-1',
      authConfigId: 'auth-1',
      externalKey: 'callback:callback-1:pair-1:callback-trigger-1'
    });
    expect(mocks.registration.upsertRegistration).toHaveBeenCalledWith({
      callbackOid: 1n,
      providerDeploymentConfigPairOid: 300n,
      callbackTriggerOid: 101n,
      data: expect.objectContaining({
        slateTriggerBindingId: 'binding-1',
        externalKey: 'callback:callback-1:pair-1:callback-trigger-1',
        status: 'active',
        lastErrorCode: null,
        lastErrorMessage: null,
        lastSyncedAt: expect.any(Date)
      })
    });
  });

  it('detaches an existing registration when the pair is no longer eligible', async () => {
    let callback = {
      id: 'callback-1',
      oid: 1n,
      tenant: { oid: 10n },
      name: 'Orders callback',
      description: null,
      status: 'active',
      providerDeploymentOid: 200n,
      slateSharedTriggerConfigId: 'shared-config-1',
      callbackTriggers: [
        {
          oid: 101n,
          id: 'callback-trigger-1',
          providerTriggerId: 'provider-trigger-1',
          providerTriggerKey: 'order.created',
          eventTypes: ['order.created'],
          slateSharedTriggerConfigTriggerId: 'shared-trigger-1'
        }
      ]
    };

    mocks.context.loadCallback
      .mockResolvedValueOnce(callback)
      .mockResolvedValueOnce(callback);
    mocks.context.isCallbackSupported.mockReturnValue(true);
    mocks.context.getTenantForSlatesCached.mockResolvedValue({ id: 'slates-tenant-1' });
    mocks.context.loadSlateContextForCallback.mockResolvedValue({
      providerConfigVersion: {
        slateInstance: {
          slate: {
            id: 'slate-1'
          }
        }
      }
    });
    mocks.context.getActiveDestinationIds.mockReturnValue(['dest-1']);
    mocks.context.matchSharedConfigTrigger.mockImplementation((config, callbackTrigger) => {
      return (
        config.triggers.find((trigger: { id: string }) => {
          return trigger.id === callbackTrigger.slateSharedTriggerConfigTriggerId;
        }) ?? null
      );
    });
    mocks.context.getPair.mockResolvedValue({
      id: 'pair-1',
      oid: 300n,
      providerDeploymentVersion: {
        deploymentOid: 200n
      }
    });
    mocks.context.isPairEligibleForCallback.mockResolvedValue(false);
    mocks.db.callbackReceiverRegistration.findFirst.mockResolvedValue({
      oid: 400n,
      slateTriggerBindingId: 'binding-1'
    });

    mocks.slates.slateSharedTriggerConfig.update.mockResolvedValue({
      id: 'shared-config-1',
      triggers: [
        {
          id: 'shared-trigger-1',
          triggerId: 'provider-trigger-1',
          triggerKey: 'order.created'
        }
      ]
    });
    mocks.slates.slateSharedTriggerConfig.triggerUpdate.mockResolvedValue({
      id: 'shared-config-1',
      triggers: [
        {
          id: 'shared-trigger-1',
          triggerId: 'provider-trigger-1',
          triggerKey: 'order.created'
        }
      ]
    });

    await syncPairTrigger({
      callbackId: 'callback-1',
      pairId: 'pair-1',
      callbackTriggerId: 'callback-trigger-1'
    });

    expect(mocks.registration.detachRegistration).toHaveBeenCalledWith({
      registrationOid: 400n,
      slateTriggerBindingId: 'binding-1',
      callbackOid: 1n,
      slatesTenantId: 'slates-tenant-1'
    });
    expect(mocks.slates.slateTriggerBinding.upsert).not.toHaveBeenCalled();
  });
});
