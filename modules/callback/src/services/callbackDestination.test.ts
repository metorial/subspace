import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL ??= 'postgres://localhost/test';
process.env.PUBLIC_SERVICE_URL ??= 'http://localhost:3000';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.SLATES_HUB_URL ??= 'http://localhost:4000';
process.env.SLATES_HUB_PUBLIC_URL ??= 'http://localhost:4000';

const mocks = vi.hoisted(() => ({
  db: {
    callbackDestination: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    callbackDestinationLink: {
      findMany: vi.fn()
    }
  },
  slatesClient: {
    slateTriggerDestination: {
      update: vi.fn()
    }
  },
  getTenantForSlates: vi.fn(),
  callbackRegistrationService: {
    enqueueConfigSync: vi.fn(),
    enqueueBindingReconcile: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  CallbackDestinationStatus: {
    deleted: 'deleted'
  },
  db: mocks.db
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: mocks.getTenantForSlates,
  slates: mocks.slatesClient
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: mocks.callbackRegistrationService
}));

import { callbackDestinationService } from './callbackDestination';

describe('callbackDestinationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the slates destination and enqueues config sync for linked callbacks only', async () => {
    mocks.db.callbackDestination.findFirst.mockResolvedValue({
      id: 'callback-destination-1',
      oid: 1n,
      tenantOid: 10n,
      solutionOid: 20n,
      name: 'Orders',
      description: 'Original',
      metadata: null,
      url: 'https://old.example.com/callback',
      method: 'POST',
      slateTriggerDestinationId: 'slates-destination-1'
    });
    mocks.getTenantForSlates.mockResolvedValue({
      id: 'slates-tenant-1'
    });
    mocks.db.callbackDestination.update.mockResolvedValue({
      id: 'callback-destination-1',
      url: 'https://new.example.com/callback',
      method: 'PATCH'
    });
    mocks.db.callbackDestinationLink.findMany.mockResolvedValue([
      { callback: { id: 'callback-1' } },
      { callback: { id: 'callback-2' } }
    ]);

    let result = await callbackDestinationService.updateCallbackDestination({
      tenant: { oid: 10n } as any,
      solution: { oid: 20n } as any,
      callbackDestinationId: 'callback-destination-1',
      input: {
        url: 'https://new.example.com/callback',
        method: 'PATCH'
      }
    });

    expect(mocks.slatesClient.slateTriggerDestination.update).toHaveBeenCalledWith({
      tenantId: 'slates-tenant-1',
      slateTriggerDestinationId: 'slates-destination-1',
      name: undefined,
      description: undefined,
      url: 'https://new.example.com/callback',
      method: 'PATCH'
    });
    expect(mocks.callbackRegistrationService.enqueueConfigSync).toHaveBeenCalledTimes(2);
    expect(mocks.callbackRegistrationService.enqueueConfigSync).toHaveBeenNthCalledWith(1, {
      callbackId: 'callback-1'
    });
    expect(mocks.callbackRegistrationService.enqueueConfigSync).toHaveBeenNthCalledWith(2, {
      callbackId: 'callback-2'
    });
    expect(mocks.callbackRegistrationService.enqueueBindingReconcile).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'callback-destination-1',
      url: 'https://new.example.com/callback',
      method: 'PATCH'
    });
  });
});
