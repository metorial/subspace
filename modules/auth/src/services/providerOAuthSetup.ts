import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  Environment,
  getId,
  ID,
  type Provider,
  type ProviderAuthCredentials,
  ProviderAuthMethodType,
  type ProviderDeployment,
  type ProviderOAuthSetup,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { addMinutes } from 'date-fns';
import { env } from '../env';
import {
  providerOAuthSetupCreatedQueue,
  providerOAuthSetupUpdatedQueue
} from '../queues/lifecycle/providerOAuthSetup';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authConfig: { include: { deployment: true } },
  authMethod: { include: { specification: { omit: { value: true } } } }
};

export let providerOAuthSetupInclude = include;

class providerOAuthSetupServiceImpl {
  async listProviderOAuthSetups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    allowDeleted?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerOAuthSetup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,
              ...normalizeStatusForList(d).onlyParent
            },
            include
          })
      )
    );
  }

  async getProviderOAuthSetupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerOAuthSetupId: string;
    allowDeleted?: boolean;
  }) {
    let providerOAuthSetup = await db.providerOAuthSetup.findFirst({
      where: {
        id: d.providerOAuthSetupId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerOAuthSetup)
      throw new ServiceError(notFoundError('provider.oauth_setup', d.providerOAuthSetupId));

    return providerOAuthSetup;
  }

  async createProviderOAuthSetup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    credentials: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
      authMethodId?: string;
      redirectUrl?: string;
      config: Record<string, any>;
      expiresAt?: Date;
    };
  }) {
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.credentials);

    checkDeletedRelation(d.providerDeployment, { allowEphemeral: d.input.isEphemeral });

    if (d.providerDeployment && d.providerDeployment.providerOid !== d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }
    if (d.credentials.providerOid !== d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth credentials do not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }

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

      let authMethod = d.input.authMethodId
        ? await db.providerAuthMethod.findFirst({
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
          })
        : await db.providerAuthMethod.findFirst({
            where: {
              providerOid: d.provider.oid,
              specificationOid: version.specificationOid,
              type: 'oauth'
            },
            orderBy: { createdAt: 'asc' }
          });
      if (!authMethod) {
        if (d.input.authMethodId) {
          throw new ServiceError(
            badRequestError({
              message: 'Invalid auth method for provider',
              code: 'invalid_auth_method'
            })
          );
        }

        throw new ServiceError(
          badRequestError({
            message: 'Provider has no OAuth auth method',
            code: 'missing_oauth_method'
          })
        );
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let newId = getId('providerOAuthSetup');
      let clientSecret = await ID.generateId('providerOAuthSetup_clientSecret');

      let backendProviderOAuthSetup = await backend.auth.createProviderOAuthSetup({
        tenant: d.tenant,
        provider: d.provider,
        providerVersion: version,
        input: d.input.config,
        credentials: d.credentials,
        authMethod,
        redirectUrl: `${env.service.PUBLIC_SERVICE_URL}/oauth-setup/${newId.id}/callback?client_secret=${clientSecret}`
      });

      let providerOAuthSetup = await db.providerOAuthSetup.create({
        data: {
          ...newId,
          clientSecret,

          status: 'unused',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,

          redirectUrl: d.input.redirectUrl,
          backendUrl: backendProviderOAuthSetup.url,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid,
          authCredentialsOid: d.credentials.oid,
          authMethodOid: authMethod.oid,

          slateOAuthSetupOid: backendProviderOAuthSetup.slateOAuthSetup?.oid,

          expiresAt: addMinutes(new Date(), 30)
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerOAuthSetupCreatedQueue.add({ providerOAuthSetupId: providerOAuthSetup.id })
      );

      return providerOAuthSetup;
    });
  }

  async updateProviderOAuthSetup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerOAuthSetup: ProviderOAuthSetup;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerOAuthSetup);

    return withTransaction(async db => {
      let config = await db.providerOAuthSetup.update({
        where: {
          oid: d.providerOAuthSetup.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
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
