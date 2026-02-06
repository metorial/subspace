import {
  createLiveConnectionClient,
  createShuttleClient
} from '@metorial-services/shuttle-client';
import { isServiceError } from '@lowerdeck/error';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withShuttleRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let start = Date.now();
  let lastError: unknown;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (isServiceError(err) && err.data?.status && err.data.status < 500) {
        throw err;
      }

      if (Date.now() - start > 30000) {
        let message = (lastError as Error)?.message ?? String(lastError);
        throw new Error(
          `Shuttle not reachable at ${env.service.SHUTTLE_URL}. Last error: ${message}`
        );
      }

      await delay(500);
    }
  }
};

export let shuttle = createShuttleClient({
  endpoint: env.service.SHUTTLE_URL
});

export let shuttleLiveClient = await createLiveConnectionClient({
  endpoint: env.service.SHUTTLE_LIVE_URL
});

export let shuttleDefaultReaderTenant = await withShuttleRetry(() =>
  shuttle.tenant.upsert({
    name: 'Subspace Default Reader',
    identifier: 'subspace-default-reader'
  })
);

export let getTenantForShuttle = async (tenant: Tenant) => {
  if (!tenant.shuttleTenantId) {
    let shuttleTenant = await shuttle.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        shuttleTenantId: shuttleTenant.id,
        shuttleTenantIdentifier: shuttleTenant.identifier
      }
    });
  }

  return {
    id: tenant.shuttleTenantId!,
    identifier: tenant.shuttleTenantIdentifier!
  };
};

export type ContainerRegistry = Awaited<ReturnType<typeof shuttle.containerRegistry.get>>;
export type ContainerRepository = Awaited<ReturnType<typeof shuttle.containerRepository.get>>;
export type NetworkingRuleset = Awaited<ReturnType<typeof shuttle.networkingRuleset.get>>;
