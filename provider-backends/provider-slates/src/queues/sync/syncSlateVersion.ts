import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { generateCode } from '@lowerdeck/id';
import { createQueue } from '@lowerdeck/queue';
import { slugify } from '@lowerdeck/slugify';
import { snowflake, withTransaction } from '@metorial-subspace/db';
import {
  providerInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { backend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

export let syncSlateVersionQueue = createQueue<{
  slateId: string;
  slateVersionId: string;
}>({
  name: 'kst/sltv/sync',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

let getRegistries = createLocallyCachedFunction({
  getHash: (id: string) => id,
  ttlSeconds: 60,
  provider: async id => slates.registry.get({ registryId: id })
});

let metorialDomains = [
  '.slates.dev',
  '.metorial.com',
  '.metorial.dev',
  '.metorial.net',
  '.metorial.app',
  '.metorial.io',
  '.metorial.ai',
  '.metorial-enterprise.com'
];

export let syncSlateVersionQueueProcessor = syncSlateVersionQueue.process(async data => {
  let version = await slates.slateVersion.get({
    slateId: data.slateId,
    slateVersionId: data.slateVersionId
  });
  if (version.status !== 'active') return;

  let slate = await slates.slate.get({
    slateId: data.slateId
  });

  let registry = await getRegistries(slate.registryId);
  let parsedUrl = new URL(registry.url);
  let isMetorialHosted = metorialDomains.some(domain => parsedUrl.hostname.endsWith(domain));

  await withTransaction(async db => {
    let slateRecord = await db.slate.upsert({
      where: { id: data.slateId },
      create: {
        oid: snowflake.nextId(),
        id: data.slateId,
        identifier: slate.identifier
      },
      update: {}
    });

    let slateVersionRecord = await db.slateVersion.upsert({
      where: { id: data.slateVersionId },
      create: {
        oid: snowflake.nextId(),
        id: data.slateVersionId,
        version: version.version,
        identifier: `${slate.identifier}::${version.version}`,
        slateOid: slateRecord.oid
      },
      update: {}
    });

    let registryRecord = await slates.slate.getRegistryRecord({
      slateId: slate.id
    });
    let registryVersionRecord = await slates.slateVersion.getRegistryRecord({
      slateId: slate.id,
      slateVersionId: version.id
    });
    let readmeNames = ['readme.md'];
    let readme = registryVersionRecord.documents.find((d: any) =>
      readmeNames.some(n => d.path.toLocaleLowerCase().endsWith(n))
    )?.content;

    let publisher = await publisherInternalService.upsertPublisher({
      owner: {
        type: isMetorialHosted ? 'metorial' : 'external'
      },
      input: {
        identifier: `slates::${slate.registryId}::${slate.scope.id}`,
        name: registryRecord.name,
        description: registryRecord.description ?? undefined
      }
    });

    let spec = version.specification?.id
      ? await slates.slateSpecification.get({
          slateSpecificationId: version.specification?.id
        })
      : null;

    let hasConfig = !!(spec ? normalizeJsonSchema(spec.configSchema) : null);
    let hasAuthConfig = !!(spec && spec.authMethods.length > 0);
    let hasOAuth = spec?.authMethods.some(am => am.type === 'oauth');
    let hasTriggers = !!(spec ? spec.triggers.length > 0 : false);

    let type = {
      name: 'Slates',

      attributes: {
        provider: 'metorial-slates',
        backend: 'slates',

        triggers: hasTriggers
          ? {
              status: 'enabled',
              receiverUrl: `${env.service.SLATES_HUB_PUBLIC_URL}/slates-hub/triggers/webhook/{callback.slatesTriggerId}`
            }
          : { status: 'disabled' },

        auth: hasAuthConfig
          ? {
              status: 'enabled',

              oauth: hasOAuth
                ? {
                    status: 'enabled',
                    oauthCallbackUrl: `${env.service.SLATES_HUB_PUBLIC_URL}/slates-hub/callback`
                  }
                : { status: 'disabled' },

              export: { status: 'enabled' },

              import: { status: 'enabled' }
            }
          : { status: 'disabled' },

        config: hasConfig
          ? { status: 'enabled', read: { status: 'enabled' } }
          : { status: 'disabled' }
      } satisfies PrismaJson.ProviderTypeAttributes
    };

    let provider = await providerInternalService.upsertProvider({
      publisher,
      source: {
        type: 'slates',
        slate: slateRecord,
        backend
      },
      info: {
        name: slate.name,
        description: slate.description ?? undefined,
        slug: slugify(`${registryRecord.fullIdentifier}-${generateCode(5)}`),
        image: registryRecord.logoUrl ? { type: 'url', url: registryRecord.logoUrl } : null,
        skills: registryRecord.skills,
        readme: readme,
        categories: registryRecord.categories.map((c: any) => c.identifier)
      },
      type
    });
    if (!provider?.defaultVariant) {
      throw new Error(`No default variant after upserting provider for slate ${slate.id}`);
    }

    let providerVersion = await providerVersionInternalService.upsertVersion({
      variant: provider.defaultVariant,
      isCurrent: version.isCurrent,
      source: {
        type: 'slates',
        slate: slateRecord,
        slateVersion: slateVersionRecord,
        backend
      },
      info: {
        name: `v${version.version}`
      },
      type
    });
  });
});
