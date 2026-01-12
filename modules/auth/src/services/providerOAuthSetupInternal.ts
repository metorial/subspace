import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  ProviderAuthConfig,
  ProviderOAuthSetup,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
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
        clientSecret: d.clientSecret
      },
      include
    });
    if (!providerOAuthSetup) throw new ServiceError(notFoundError('provider_config'));

    return providerOAuthSetup;
  }

  async syncProviderOAuthSetupRecord(d: { providerOAuthSetup: ProviderOAuthSetup }) {
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
            solution: true
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
                slateAuthConfig: record.slateAuthConfig
              }
            });
          }
        }

        return db.providerOAuthSetup.update({
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
      })
    );
  }
}

export let providerOAuthSetupInternalService = Service.create(
  'providerOAuthSetup',
  () => new providerOAuthSetupInternalServiceImpl()
).build();
