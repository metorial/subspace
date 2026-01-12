import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  ID,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethodType,
  ProviderDeployment,
  ProviderOAuthSetup,
  ProviderVariant,
  ProviderVersion,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { getBackend } from '@metorial-subspace/provider';
import { env } from '../env';
import {
  providerOAuthSetupCreatedQueue,
  providerOAuthSetupUpdatedQueue
} from '../queues/lifecycle/providerOAuthSetup';

let include = {};

class providerOAuthSetupServiceImpl {
  async listProviderOAuthSetups(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthSetup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              isEphemeral: false
            },
            include
          })
      )
    );
  }

  async getProviderOAuthSetupById(d: { tenant: Tenant; providerOAuthSetupId: string }) {
    let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
      where: {
        id: d.providerOAuthSetupId,
        tenantOid: d.tenant.oid
      },
      include
    });
    if (!providerOAuthSetup)
      throw new ServiceError(notFoundError('provider_config', d.providerOAuthSetupId));

    return providerOAuthSetup;
  }

  async createProviderOAuthSetup(d: {
    tenant: Tenant;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    credentials: ProviderAuthCredentials;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral: boolean;
      isDefault: boolean;
      authMethodId: string;
      redirectUrl: string;
    };
  }) {
    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let version = await providerDeploymentInternalService.getCurrentVersionOptional({
        provider: d.provider,
        deployment: d.providerDeployment
      });
      if (!version.specificationOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider has not been discovered'
          })
        );
      }

      let authMethod = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: version.specificationOid,
          OR: [
            { id: d.input.authMethodId },
            { specId: d.input.authMethodId },
            { specUniqueIdentifier: d.input.authMethodId },
            { key: d.input.authMethodId },
            { callableId: d.input.authMethodId },

            ...(ProviderAuthMethodType[
              d.input.authMethodId as keyof typeof ProviderAuthMethodType
            ]
              ? [{ type: d.input.authMethodId as any }]
              : [])
          ]
        }
      });
      if (!authMethod) {
        throw new ServiceError(
          badRequestError({
            message: 'Invalid auth method for provider',
            code: 'invalid_auth_method'
          })
        );
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let newId = getId('providerOAuthSetup');

      let backendProviderOAuthSetup = await backend.auth.createProviderOAuthSetup({
        tenant: d.tenant,
        provider: d.provider,
        providerVersion: version,
        input: d.input,
        credentials: d.credentials,
        authMethod,
        redirectUrl: `${env.service.OAUTH_HOOK_URL}/subspace/oauth-setup/backend-callback/${newId.id}`
      });

      let providerOAuthSetup = await db.providerOAuthSetup.create({
        data: {
          ...newId,

          status: 'unused',

          clientSecret: await ID.generateId('providerOAuthSetup_clientSecret'),

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          isEphemeral: d.input.isEphemeral,

          redirectUrl: d.input.redirectUrl,

          tenantOid: d.tenant.oid,
          providerOid: d.provider.oid,
          authCredentialsOid: d.credentials.oid,
          authMethodOid: authMethod.oid,

          slateOAuthSetupOid: backendProviderOAuthSetup.slateOAuthSetup?.oid
        }
      });

      await addAfterTransactionHook(async () =>
        providerOAuthSetupCreatedQueue.add({ providerOAuthSetupId: providerOAuthSetup.id })
      );

      return providerOAuthSetup;
    });
  }

  async updateProviderOAuthSetup(d: {
    tenant: Tenant;
    providerOAuthSetup: ProviderOAuthSetup;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let config = await db.providerOAuthSetup.update({
        where: {
          oid: d.providerOAuthSetup.oid,
          tenantOid: d.tenant.oid
        },
        data: {
          name: d.input.name ?? d.providerOAuthSetup.name,
          description: d.input.description ?? d.providerOAuthSetup.description,
          metadata: d.input.metadata ?? d.providerOAuthSetup.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerOAuthSetupUpdatedQueue.add({ providerOAuthSetupId: config.id })
      );

      return config;
    });
  }
}

export let providerOAuthSetupService = Service.create(
  'providerOAuthSetup',
  () => new providerOAuthSetupServiceImpl()
).build();
