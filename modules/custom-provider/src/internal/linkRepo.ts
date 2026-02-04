import { createLock } from '@lowerdeck/lock';
import { Actor, db, snowflake, Solution, Tenant } from '@metorial-subspace/db';
import { env } from '../env';
import { getTenantForOrigin, origin } from '../origin';

let createCodeBucketLock = createLock({
  name: 'sub/cpr/code-bucket/create',
  redisUrl: env.service.REDIS_URL
});

export let linkRepo = async (d: {
  tenant: Tenant;
  solution: Solution;
  actor: Actor;
  repo:
    | {
        repositoryId: string;
        branch: string;
        path?: string;
      }
    | {
        type?: 'git';
        repositoryUrl: string;
        branch: string;
        path?: string;
      };
}) => {
  let originTenant = await getTenantForOrigin(d.tenant);
  let originActor = await origin.actor.upsert({
    name: d.actor.name,
    identifier: d.actor.identifier
  });

  let originRepo =
    'repositoryId' in d.repo
      ? await origin.scmRepository.get({
          tenantId: originTenant.id,
          scmRepositoryId: d.repo.repositoryId
        })
      : await origin.scmRepository.searchAndLinkRepo({
          tenantId: originTenant.id,
          actorId: originActor.id,
          repositoryUrl: d.repo.repositoryUrl
        });

  let inner = {
    identifier: originRepo.identifier,
    provider: originRepo.provider,
    fromRepoUrl: 'repositoryUrl' in d.repo ? d.repo.repositoryUrl : undefined,
    name: originRepo.name,

    externalId: originRepo.externalId,
    externalName: originRepo.externalName,
    externalOwner: originRepo.externalOwner,
    externalUrl: originRepo.externalUrl,
    externalIsPrivate: originRepo.externalIsPrivate,

    defaultBranch: originRepo.defaultBranch
  };

  let repo = await db.scmRepo.upsert({
    where: { id: originRepo.id },
    create: {
      oid: snowflake.nextId(),
      id: originRepo.id,
      ...inner,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid
    },
    update: inner
  });

  let codeBucketFilter = {
    scmRepoOid: repo.oid,
    scmRepoPath: d.repo.path ?? '/',
    isImmutable: true,
    isReadOnly: true,
    scmRepo: {
      oid: repo.oid
    }
  };
  let immutableSyncedCodeBucket = await db.codeBucket.findFirst({
    where: codeBucketFilter
  });

  if (!immutableSyncedCodeBucket) {
    let bucket = await origin.codeBucket.createFromRepo({
      tenantId: originTenant.id,
      scmRepoId: originRepo.id,
      purpose: 'subspace.custom_provider_files',
      path: d.repo.path ?? '/',
      isReadOnly: true,
      isSynced: true
    });

    immutableSyncedCodeBucket = await db.codeBucket.create({
      data: {
        oid: snowflake.nextId(),
        id: bucket.id,

        scmRepoOid: repo.oid,
        scmRepoPath: d.repo.path ?? '/',

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,

        isImmutable: false,
        isReadOnly: true
      }
    });
  }

  return {
    repo,
    immutableSyncedCodeBucket
  };
};
