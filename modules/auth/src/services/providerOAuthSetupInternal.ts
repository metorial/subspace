import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  ProviderAuthConfig,
  ProviderOAuthSetup,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import { providerAuthSessionUpdatedQueue } from '../queues/lifecycle/providerAuthSession';
import { providerOAuthSetupUpdatedQueue } from '../queues/lifecycle/providerOAuthSetup';
import { providerAuthConfigService } from './providerAuthConfig';

let include = {};

let syncLock = createLock({
  name: 'auth/setupInternal/sync',
  redisUrl: env.service.REDIS_URL
});

class providerOAuthSetupInternalServiceImpl {
  async getProviderOAuthSetupByClientSecret(d: { clientSecret: string }) {
    let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
      where: {
        clientSecret: d.clientSecret,
        expiresAt: { gt: new Date() }
      },
      include
    });
    if (!providerOAuthSetup) throw new ServiceError(notFoundError('provider.oauth_setup'));

    return providerOAuthSetup;
  }

  async handleOAuthSetupResponse(d: {
    providerOAuthSetup: ProviderOAuthSetup;
    context: {
      ip: string;
      ua: string;
    };
  }) {
    return syncLock.usingLock(d.providerOAuthSetup.id, () =>
      withTransaction(async db => {
        let providerOAuthSetup = await db.providerOAuthSetup.findUniqueOrThrow({
          where: { oid: d.providerOAuthSetup.oid },
          include: {
            authCredentials: true,
            tenant: true,
            authMethod: true,
            provider: true,
            deployment: true,
            solution: true,
            providerAuthSession: true
          }
        });

        let backend = await getBackend({ entity: providerOAuthSetup.authCredentials });

        let record = await backend.auth.retrieveProviderOAuthSetup({
          tenant: providerOAuthSetup.tenant,
          setup: providerOAuthSetup
        });

        let authConfig: ProviderAuthConfig | undefined = undefined;

        if (record.slateAuthConfig) {
          let existing = await db.providerAuthConfig.findUnique({
            where: { oid: record.slateAuthConfig.oid, tenantOid: providerOAuthSetup.tenantOid }
          });
          if (existing) {
            authConfig = existing;
          } else {
            authConfig = await providerAuthConfigService.createProviderAuthConfigInternal({
              backend: backend.backend,
              source: providerOAuthSetup.providerAuthSession ? 'auth_session' : 'system',
              type: 'oauth_automated',
              tenant: providerOAuthSetup.tenant,
              provider: providerOAuthSetup.provider,
              solution: providerOAuthSetup.solution,
              providerDeployment: providerOAuthSetup.deployment ?? undefined,
              input: {
                name: providerOAuthSetup.name ?? undefined,
                description: providerOAuthSetup.description ?? undefined,
                metadata: providerOAuthSetup.metadata ?? undefined,
                isEphemeral: providerOAuthSetup.isEphemeral,
                isDefault: false
              },
              authMethod: providerOAuthSetup.authMethod,
              backendProviderAuthConfig: {
                slateAuthConfig: record.slateAuthConfig,
                expiresAt: null
              }
            });
          }
        }

        let setup = await db.providerOAuthSetup.update({
          where: { oid: providerOAuthSetup.oid },
          data: {
            status:
              record.status == 'failed'
                ? 'failed'
                : record.status == 'completed'
                  ? 'completed'
                  : undefined,

            errorCode: record.error?.code,
            errorMessage: record.error?.message ?? record.error?.code,

            slateOAuthSetupOid: record.slateOAuthSetup?.oid,
            authConfigOid: authConfig?.oid ?? null
          }
        });

        let session = await db.providerAuthSession.findFirst({
          where: {
            oauthSetupOid: providerOAuthSetup.oid,
            status: { notIn: ['completed', 'expired', 'archived', 'deleted'] }
          }
        });
        if (session) {
          if (setup.status == 'completed') {
            await db.providerAuthSession.update({
              where: { oid: session.oid },
              data: {
                status: 'completed',
                authCredentialsOid: setup.authCredentialsOid,
                authConfigOid: setup.authConfigOid
              }
            });

            await db.providerAuthSessionEvent.createMany({
              data: [
                {
                  ...getId('providerAuthSessionEvent'),
                  type: 'oauth_setup_completed',
                  ip: d.context.ip,
                  ua: d.context.ua,
                  sessionOid: session.oid
                },
                {
                  ...getId('providerAuthSessionEvent'),
                  type: 'completed',
                  sessionOid: session.oid,
                  ip: d.context.ip,
                  ua: d.context.ua
                }
              ]
            });

            setup = await db.providerOAuthSetup.update({
              where: { oid: setup.oid },
              data: { redirectUrl: session.redirectUrl }
            });
          } else {
            await db.providerAuthSession.update({
              where: { oid: session.oid },
              data: {
                status: 'failed',
                authCredentialsOid: setup.authCredentialsOid,
                authConfigOid: setup.authConfigOid
              }
            });

            await db.providerAuthSessionEvent.createMany({
              data: [
                {
                  ...getId('providerAuthSessionEvent'),
                  type: 'oauth_setup_failed',
                  ip: d.context.ip,
                  ua: d.context.ua,
                  sessionOid: session.oid
                }
              ]
            });
          }
        }

        if (session) {
          addAfterTransactionHook(async () =>
            providerAuthSessionUpdatedQueue.add({ providerAuthSessionId: session.id })
          );
        }

        addAfterTransactionHook(async () =>
          providerOAuthSetupUpdatedQueue.add({ providerOAuthSetupId: setup.id })
        );

        return setup;
      })
    );
  }
}

export let providerOAuthSetupInternalService = Service.create(
  'providerOAuthSetup',
  () => new providerOAuthSetupInternalServiceImpl()
).build();
