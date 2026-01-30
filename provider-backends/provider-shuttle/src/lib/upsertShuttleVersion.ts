import { generateCode, generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import {
  withTransaction,
  type Publisher,
  type ShuttleServer,
  type ShuttleServerVersion
} from '@metorial-subspace/db';
import {
  providerInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { backend } from '../backend';
import type { shuttle } from '../client';
import { env } from '../env';

export type Server = Awaited<ReturnType<typeof shuttle.server.get>>;
export type Version = Awaited<ReturnType<typeof shuttle.serverVersion.get>>;

export let upsertShuttleServerVersion = ({
  shuttleServer: server,
  shuttleServerVersion: version,

  shuttleServerRecord,
  shuttleServerVersionRecord
}: {
  shuttleServer: Server;
  shuttleServerVersion: Version;

  shuttleServerRecord: ShuttleServer;
  shuttleServerVersionRecord: ShuttleServerVersion;
}) =>
  withTransaction(async db => {
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
      name: `MCP`,

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

    return { provider, providerVersion };
  });
