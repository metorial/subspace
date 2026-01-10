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
import { backend } from '../../backend';
import { slates } from '../../client';
import { env } from '../../env';

export let syncSlateVersionQueue = createQueue<{
  slateId: string;
  slateVersionId: string;
}>({
  name: 'kst/sltv/sync',
  redisUrl: env.service.SLATES_HUB_URL,
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
  '.metorial-enterprise.com'
];

export let syncSlateVersionQueueProcessor = syncSlateVersionQueue.process(async data => {
  let version = await slates.slateVersion.get({
    slateId: data.slateId,
    slateVersionId: data.slateVersionId
  });

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
    let readme = registryVersionRecord.documents.find(d =>
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
        readme: readme
      }
    });
    if (!provider?.defaultVariant) {
      throw new Error('No default variant after upserting provider for slate ' + slate.id);
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
      }
    });
  });
});
