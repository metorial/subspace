import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  Actor,
  addAfterTransactionHook,
  CustomProviderDeployment,
  CustomProviderFrom,
  CustomProviderVersion,
  db,
  Environment,
  snowflake,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { backend, CustomProviderFromInternal } from '../../_shuttle/backend';
import { env } from '../../env';
import { createVersion } from '../../internal/createVersion';
import { ensureEnvironments } from '../../internal/ensureEnvironments';
import { linkRepo } from '../../internal/linkRepo';
import { getTenantForOrigin, origin } from '../../origin';
import { customProviderCreatedQueue } from '../lifecycle/customProvider';

export let handleUpcomingCustomProviderQueue = createQueue<{
  upcomingCustomProviderId: string;
}>({
  name: 'sub/cpr/up/hdl',
  redisUrl: env.service.REDIS_URL
});

let mapFrom = (d: {
  deployment: CustomProviderDeployment;
  version: CustomProviderVersion;
  from: CustomProviderFrom;

  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  actor: Actor;
}): Promise<CustomProviderFromInternal> =>
  withTransaction(async db => {
    if (d.from.type == 'container') {
      return {
        type: 'container.from_image_ref',
        ...d.from.repository
      };
    }

    if (d.from.type == 'remote') {
      return d.from;
    }

    if (d.from.type == 'function') {
      let currentProvider = await db.customProvider.findUniqueOrThrow({
        where: { oid: d.version.customProviderOid }
      });

      if (d.from.repository) {
        let provider = await db.customProvider.findUnique({
          where: { oid: d.version.customProviderOid },
          include: { scmRepo: true }
        });

        if (
          !provider?.scmRepo ||
          ('repositoryId' in d.from.repository
            ? provider.scmRepo.id !== d.from.repository.repositoryId
            : provider.scmRepo.fromRepoUrl !== d.from.repository.repositoryUrl)
        ) {
          let linkedRepo = await linkRepo({
            tenant: d.tenant,
            solution: d.solution,
            actor: d.actor,
            repo: d.from.repository
          });

          currentProvider = await db.customProvider.update({
            where: { oid: d.version.customProviderOid },
            data: {
              scmRepoOid: linkedRepo.repo.oid,
              draftCodeBucketOid: linkedRepo.immutableSyncedCodeBucket.oid
            }
          });
        }
      }

      if (!currentProvider.draftCodeBucketOid) {
        throw new Error('Cannot create function deployment without linked SCM repository');
      }

      let codeBucket = await db.codeBucket.findUniqueOrThrow({
        where: { oid: currentProvider.draftCodeBucketOid }
      });

      let tenant = await getTenantForOrigin(d.tenant);

      let immutableBucketOriginId: string;
      if (d.deployment.scmRepoPushOid) {
        let push = await db.scmRepoPush.findUniqueOrThrow({
          where: { oid: d.deployment.scmRepoPushOid },
          include: { repo: true }
        });

        let immutableBucketOrigin = await origin.codeBucket.createFromRepo({
          tenantId: tenant.id,
          scmRepoId: push.repo.id,
          purpose: 'subspace.custom_provider_files',
          path: codeBucket.scmRepoPath ?? '/',
          ref: push.sha,
          isReadOnly: true,
          isSynced: false
        });
        immutableBucketOriginId = immutableBucketOrigin.id;
      } else {
        let immutableBucketOrigin = await origin.codeBucket.clone({
          tenantId: tenant.id,
          codeBucketId: codeBucket.id
        });
        immutableBucketOriginId = immutableBucketOrigin.id;
      }

      let immutableBucket = await db.codeBucket.create({
        data: {
          oid: snowflake.nextId(),
          id: immutableBucketOriginId,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,

          isReadOnly: true,
          isImmutable: true
        }
      });

      await db.customProviderVersion.updateMany({
        where: { oid: d.version.oid },
        data: {
          immutableCodeBucketOid: immutableBucket.oid,
          scmRepoOid: currentProvider.scmRepoOid
        }
      });

      await db.customProviderDeployment.updateMany({
        where: { oid: d.version.deploymentOid },
        data: {
          immutableCodeBucketOid: immutableBucket.oid,
          scmRepoOid: currentProvider.scmRepoOid
        }
      });

      let files = await origin.codeBucket.getFiles({
        tenantId: tenant.id,
        codeBucketId: immutableBucketOriginId
      });

      return {
        type: 'function',

        env: d.from.env,
        runtime: d.from.runtime,
        files: files.files.map((f: any) => ({
          filename: f.path,
          content: f.content,
          encoding: f.encoding
        }))
      };
    }

    throw new Error('Unsupported from type');
  });

export let handleUpcomingCustomProviderQueueProcessor =
  handleUpcomingCustomProviderQueue.process(async data => {
    let upcoming = await db.upcomingCustomProvider.findUnique({
      where: { id: data.upcomingCustomProviderId },
      include: {
        tenant: true,
        solution: true,
        environment: true,
        actor: true,
        customProvider: true,
        customProviderDeployment: true,
        customProviderVersion: true
      }
    });
    if (!upcoming) throw new QueueRetryError();

    if (upcoming.type == 'create_custom_provider') {
      await withTransaction(async db => {
        let backendProvider = await backend.createCustomProvider({
          tenant: upcoming.tenant,

          name: upcoming.customProvider.name,
          description: upcoming.customProvider.description ?? undefined,

          config: upcoming.payload.config,
          from: await mapFrom({
            deployment: upcoming.customProviderDeployment,
            version: upcoming.customProviderVersion,
            from: upcoming.payload.from,

            tenant: upcoming.tenant,
            solution: upcoming.solution,
            environment: upcoming.environment,
            actor: upcoming.actor
          })
        });

        await ensureEnvironments({ customProvider: upcoming.customProvider });

        await createVersion({
          actor: upcoming.actor,
          tenant: upcoming.tenant,
          solution: upcoming.solution,
          environment: upcoming.environment,

          version: upcoming.customProviderVersion,
          customProvider: upcoming.customProvider,
          deployment: upcoming.customProviderDeployment,

          message: upcoming.message ?? 'Initial commit',

          shuttleServer: backendProvider.shuttleServer,
          shuttleCustomServer: backendProvider.shuttleCustomServer,
          shuttleCustomDeployment: backendProvider.shuttleCustomDeployment
        });

        await addAfterTransactionHook(async () =>
          customProviderCreatedQueue.add({ customProviderId: upcoming.customProvider.id })
        );

        await db.upcomingCustomProvider.delete({
          where: { id: upcoming.id }
        });
      });
    } else {
      let backendProvider = await backend.createCustomProviderVersion({
        tenant: upcoming.tenant,

        customProvider: upcoming.customProvider,

        config: upcoming.payload.config!,
        from: await mapFrom({
          deployment: upcoming.customProviderDeployment,
          version: upcoming.customProviderVersion,
          from: upcoming.payload.from,

          tenant: upcoming.tenant,
          solution: upcoming.solution,
          environment: upcoming.environment,
          actor: upcoming.actor
        })
      });

      await withTransaction(async db => {
        await ensureEnvironments({ customProvider: upcoming.customProvider });

        await createVersion({
          actor: upcoming.actor,
          tenant: upcoming.tenant,
          solution: upcoming.solution,
          environment: upcoming.environment,

          message: upcoming.message ?? undefined,

          customProvider: upcoming.customProvider,
          version: upcoming.customProviderVersion,
          deployment: upcoming.customProviderDeployment,

          shuttleServer: backendProvider.shuttleServer,
          shuttleCustomServer: backendProvider.shuttleCustomServer,
          shuttleCustomDeployment: backendProvider.shuttleCustomDeployment
        });
      });
    }
  });
