import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  Backend,
  db,
  getId,
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigType,
  ProviderAuthImport,
  ProviderAuthMethod,
  ProviderAuthMethodType,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { ProviderAuthConfigCreateRes } from '@metorial-subspace/provider-utils';
import {
  providerAuthConfigCreatedQueue,
  providerAuthConfigUpdatedQueue
} from '../queues/lifecycle/providerAuthConfig';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authMethod: true
};

export let providerAuthConfigInclude = include;

class providerAuthConfigServiceImpl {
  async listProviderAuthConfigs(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              isEphemeral: false
            },
            include
          })
      )
    );
  }

  async getProviderAuthConfigById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthConfigId: string;
  }) {
    let providerAuthConfig = await db.providerAuthConfig.findFirst({
      where: {
        id: d.providerAuthConfigId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthConfig)
      throw new ServiceError(notFoundError('provider_config', d.providerAuthConfigId));

    return providerAuthConfig;
  }

  async createProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
      authMethodId?: string;
      config: Record<string, any>;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerDeployment);

    if (d.providerDeployment && d.providerDeployment.providerOid != d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default provider configs must be associated with a deployment',
          code: 'default_config_requires_deployment'
        })
      );
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let { version, authMethod } = await this.getVersionAndAuthMethod({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        authMethodId: d.input.authMethodId
      });

      let backendRes = await this.createBackendProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,

        provider: d.provider,
        providerVersion: version,
        authMethod,

        config: d.input.config
      });

      return await this.createProviderAuthConfigInternal({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        input: d.input,
        import: d.import,
        authMethod,
        backend: backendRes.backend,
        backendProviderAuthConfig: backendRes.backendProviderAuthConfig,
        type: authMethod.type == 'oauth' ? 'oauth_manual' : 'manual'
      });
    });
  }

  async updateProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthConfig: ProviderAuthConfig;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config?: Record<string, any>;

      authMethodId?: string;
    };

    import: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerAuthConfig);

    if (d.providerAuthConfig.type == 'oauth_automated') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update automated OAuth provider auth configs',
          code: 'cannot_update_automated_oauth_config'
        })
      );
    }

    return withTransaction(async db => {
      let provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.providerOid },
        include: { defaultVariant: true }
      });
      let providerDeployment = d.providerAuthConfig.deploymentOid
        ? await db.providerDeployment.findFirstOrThrow({
            where: { oid: d.providerAuthConfig.deploymentOid },
            include: { lockedVersion: true }
          })
        : undefined;

      let { version, authMethod } = await this.getVersionAndAuthMethod({
        tenant: d.tenant,
        solution: d.solution,
        provider: provider,
        providerDeployment,
        authMethodId: d.providerAuthConfig.authMethodOid
      });
      if (d.input.authMethodId && d.input.authMethodId != authMethod.id) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change auth method of existing auth config',
            code: 'cannot_change_auth_method'
          })
        );
      }

      let backendRes = d.input.config
        ? await this.createBackendProviderAuthConfig({
            tenant: d.tenant,
            solution: d.solution,

            provider,
            providerVersion: version,
            authMethod,

            config: d.input.config
          })
        : undefined;

      let config = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthConfig.name,
          description: d.input.description ?? d.providerAuthConfig.description,
          metadata: d.input.metadata ?? d.providerAuthConfig.metadata,

          slateAuthConfigOid: backendRes?.backendProviderAuthConfig?.slateAuthConfig?.oid
        },
        include
      });

      let authImport: ProviderAuthImport | undefined = undefined;

      if (backendRes) {
        let update = await db.providerAuthConfigUpdate.create({
          data: {
            ...getId('providerAuthConfigUpdate'),
            authConfigOid: config.oid,
            slateAuthConfigOid: config.slateAuthConfigOid
          }
        });

        authImport = await db.providerAuthImport.create({
          data: {
            ...getId('providerAuthImport'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            authConfigOid: config.oid,
            authConfigUpdateOid: update.oid,
            deploymentOid: d.providerAuthConfig.deploymentOid,

            ip: d.import.ip,
            ua: d.import.ua,
            note: d.import.note,
            metadata: d.input.metadata
          }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigUpdatedQueue.add({ providerAuthConfigId: config.id })
      );

      return {
        ...config,
        authImport
      };
    });
  }

  async createProviderAuthConfigInternal(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider;
    providerDeployment?: ProviderDeployment;
    backend: Backend;
    type: ProviderAuthConfigType;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
    };
    import?: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };

    authMethod: ProviderAuthMethod;
    backendProviderAuthConfig: ProviderAuthConfigCreateRes;
  }) {
    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.backendProviderAuthConfig.slateAuthConfig);

    if (d.providerDeployment && d.providerDeployment.providerOid != d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }
    if (d.authMethod.providerOid != d.provider.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth method does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }

    return withTransaction(async db => {
      let providerAuthConfig = await db.providerAuthConfig.create({
        data: {
          ...getId('providerAuthConfig'),

          backendOid: d.backend.oid,

          type: d.type,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          providerOid: d.provider.oid,
          authMethodOid: d.authMethod.oid,
          deploymentOid: d.providerDeployment?.oid,

          slateAuthConfigOid: d.backendProviderAuthConfig.slateAuthConfig?.oid
        },
        include
      });

      let update = await db.providerAuthConfigUpdate.create({
        data: {
          ...getId('providerAuthConfigUpdate'),
          authConfigOid: providerAuthConfig.oid,
          slateAuthConfigOid: providerAuthConfig.slateAuthConfigOid
        }
      });

      let authImport: ProviderAuthImport | undefined = undefined;

      if (d.import && providerAuthConfig.type != 'oauth_automated') {
        authImport = await db.providerAuthImport.create({
          data: {
            ...getId('providerAuthImport'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            authConfigOid: providerAuthConfig.oid,
            authConfigUpdateOid: update.oid,
            deploymentOid: d.providerDeployment?.oid,

            ip: d.import.ip,
            ua: d.import.ua,
            note: d.import.note,
            metadata: d.input.metadata,

            expiresAt: d.backendProviderAuthConfig.expiresAt
          }
        });
      }

      if (providerAuthConfig.isDefault && d.providerDeployment) {
        if (d.providerDeployment.defaultAuthConfigOid) {
          await db.providerAuthConfig.updateMany({
            where: {
              deploymentOid: d.providerDeployment.oid,
              isDefault: true
            },
            data: { isDefault: false }
          });
        }

        await db.providerDeployment.update({
          where: { oid: d.providerDeployment.oid },
          data: { defaultAuthConfigOid: providerAuthConfig.oid }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigCreatedQueue.add({ providerAuthConfigId: providerAuthConfig.id })
      );

      return {
        ...providerAuthConfig,
        authImport
      };
    });
  }

  private async getVersionAndAuthMethod(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      lockedVersion: ProviderVersion | null;
    };
    authMethodId?: string | bigint;
  }) {
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

    if (!d.authMethodId) {
      let authMethod = await db.providerAuthMethod.findFirst({
        where: {
          providerOid: d.provider.oid,
          specificationOid: version.specificationOid,
          isDefault: true
        }
      });
      if (!authMethod) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider does not support authentication'
          })
        );
      }

      return { version, authMethod };
    }

    let authMethod = await db.providerAuthMethod.findFirst({
      where: {
        providerOid: d.provider.oid,
        specificationOid: version.specificationOid,

        ...(typeof d.authMethodId == 'string'
          ? {
              OR: [
                { id: d.authMethodId },
                { specId: d.authMethodId },
                { specUniqueIdentifier: d.authMethodId },
                { key: d.authMethodId },
                { callableId: d.authMethodId },

                ...(ProviderAuthMethodType[
                  d.authMethodId as keyof typeof ProviderAuthMethodType
                ]
                  ? [{ type: d.authMethodId as any }]
                  : [])
              ]
            }
          : { oid: d.authMethodId })
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

    return { version, authMethod };
  }

  private async createBackendProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion: ProviderVersion;
    authMethod: ProviderAuthMethod;

    config: Record<string, any>;
  }) {
    let backend = await getBackend({
      entity: d.provider.defaultVariant!
    });

    let backendProviderAuthConfig = await backend.auth.createProviderAuthConfig({
      tenant: d.tenant,
      provider: d.provider,
      providerVersion: d.providerVersion,
      authMethod: d.authMethod,
      input: d.config
    });

    return {
      backend: backend.backend,
      backendProviderAuthConfig
    };
  }
}

export let providerAuthConfigService = Service.create(
  'providerAuthConfig',
  () => new providerAuthConfigServiceImpl()
).build();
