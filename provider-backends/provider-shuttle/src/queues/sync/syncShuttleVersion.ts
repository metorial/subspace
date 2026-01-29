import { generateCode, generatePlainId } from '@lowerdeck/id';
import { createQueue } from '@lowerdeck/queue';
import { slugify } from '@lowerdeck/slugify';
import { snowflake, withTransaction, type Publisher } from '@metorial-subspace/db';
import {
  providerInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { backend } from '../../backend';
import { shuttle, shuttleDefaultReaderTenant } from '../../client';
import { env } from '../../env';

export let syncShuttleVersionQueue = createQueue<{
  serverId: string;
  serverVersionId: string;
  tenantId: string | undefined;
}>({
  name: 'kst/shut/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

export let syncShuttleVersionQueueProcessor = syncShuttleVersionQueue.process(async data => {
  let version = await shuttle.serverVersion.get({
    serverVersionId: data.serverVersionId,
    tenantId: data.tenantId ?? shuttleDefaultReaderTenant.id
  });

  let server = await shuttle.server.get({
    serverId: version.serverId,
    tenantId: version.tenantId ?? shuttleDefaultReaderTenant.id
  });

  await withTransaction(async db => {
    let shuttleServerRecord = await db.shuttleServer.upsert({
      where: { id: data.serverId },
      create: {
        oid: snowflake.nextId(),
        id: server.id,
        identifier: server.id,
        shuttleTenantId: server.tenantId
      },
      update: {}
    });

    let shuttleServerVersionRecord = await db.shuttleServerVersion.upsert({
      where: { id: version.id },
      create: {
        oid: snowflake.nextId(),
        id: version.id,
        version: version.id,
        identifier: `${server.id}::${version.id}`,
        serverOid: shuttleServerRecord.oid
      },
      update: {}
    });

    let publisher: Publisher | null = null;

    if (server.tenantId) {
      let tenant = await db.tenant.findFirst({
        where: { shuttleTenantId: server.tenantId }
      });

      if (tenant) {
        publisher = await publisherInternalService.upsertPublisherForTenant({
          tenant
        });
      }
    }

    if (!publisher) {
      if (server.type == 'container') {
        publisher = await publisherInternalService.upsertPublisherForExternal({
          identifier: `shuttle::registry::${version.repositoryVersion?.repository.registry.id}`,
          name:
            version.repositoryVersion?.repository.registry.name ??
            version.repositoryVersion?.repository.registry.url ??
            'Unknown Registry'
        });
      } else if (server.type == 'remote') {
        publisher = await publisherInternalService.upsertPublisherForExternal({
          identifier: `shuttle::remote::${version.remoteUrl}`,
          name: `MCP Remote (${version.remoteUrl ?? 'unknown'})`
        });
      }
    }

    if (!publisher) {
      publisher = await publisherInternalService.upsertUnknownPublisher();
    }

    let hasConfig = !!(version.configSchema
      ? normalizeJsonSchema(version.configSchema.configSchema)
      : null);

    let type = {
      name: 'Shuttles',

      attributes: {
        provider: 'metorial-shuttle',
        backend: `mcp.${server.type}`,

        triggers: { status: 'disabled' },

        auth: server.oauthConfig
          ? {
              status: 'enabled',

              oauth: {
                status: 'enabled',
                oauthCallbackUrl: `${env.service.SHUTTLE_PUBLIC_URL}/shuttle-oauth/callback`
              },

              export: { status: 'enabled' },
              import: { status: 'enabled' }
            }
          : { status: 'disabled' },

        config: hasConfig
          ? { status: 'enabled', read: { status: 'disabled' } }
          : { status: 'disabled' }
      } satisfies PrismaJson.ProviderTypeAttributes
    };

    let provider = await providerInternalService.upsertProvider({
      publisher,
      source: {
        type: 'shuttle',
        shuttleServer: shuttleServerRecord,
        backend
      },
      info: {
        name: server.name,
        description: server.description ?? undefined,
        slug: slugify(`${server.name}-${generateCode(5)}`)
      },
      type
    });
    if (!provider?.defaultVariant) {
      throw new Error(`No default variant after upserting provider for server ${server.id}`);
    }

    let providerVersion = await providerVersionInternalService.upsertVersion({
      variant: provider.defaultVariant,
      isCurrent: version.isCurrent,
      source: {
        type: 'shuttle',
        shuttleServer: shuttleServerRecord,
        shuttleServerVersion: shuttleServerVersionRecord,
        backend
      },
      info: {
        name: generatePlainId(8)
      },
      type
    });
  });
});
