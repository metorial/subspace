import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderAuthConfig,
  ProviderAuthConfigSource,
  ProviderAuthImport,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { providerAuthConfigUpdatedQueue } from '../queues/lifecycle/providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authMethod: { include: { specification: { omit: { value: true } } } }
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
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,

        OR: [
          { id: d.providerAuthConfigId },
          { providerSetupSession: { id: d.providerAuthConfigId } }
        ]
      },
      include
    });
    if (!providerAuthConfig)
      throw new ServiceError(notFoundError('provider.auth_config', d.providerAuthConfigId));

    return providerAuthConfig;
  }

  async getProviderAuthConfigSchema(d: {
    tenant: Tenant;
    solution: Solution;

    provider?: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion?: ProviderVersion;
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };

    providerAuthConfig?: ProviderAuthConfig & { deployment: ProviderDeployment | null };

    authMethodId?: string;
  }) {
    if (d.providerAuthConfig) {
      let authMethod = await db.providerAuthMethod.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.authMethodOid }
      });
      return authMethod.value;
    }

    let provider: (Provider & { defaultVariant: ProviderVariant | null }) | undefined =
      undefined;
    if (d.provider) {
      provider = d.provider;
    } else if (d.providerDeployment) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerDeployment.providerOid },
        include: { defaultVariant: true }
      });
    } else if (d.providerVersion) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerVersion.providerOid },
        include: { defaultVariant: true }
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message:
            'Must provide provider, provider deployment, provider version, or provider auth config to get schema',
          code: 'missing_provider_information'
        })
      );
    }

    let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod({
      tenant: d.tenant,
      solution: d.solution,

      provider,
      providerDeployment: d.providerDeployment,
      authMethodId: d.authMethodId
    });

    return authMethod.value;
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
    source: ProviderAuthConfigSource;
    input: {
      name?: string;
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

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId
        });

      let backendRes = await providerAuthConfigInternalService.createBackendProviderAuthConfig(
        {
          tenant: d.tenant,
          solution: d.solution,

          provider: d.provider,
          providerVersion: version,
          authMethod,

          config: d.input.config
        }
      );

      return await providerAuthConfigInternalService.createProviderAuthConfigInternal({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        source: d.source,
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

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
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
        ? await providerAuthConfigInternalService.createBackendProviderAuthConfig({
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
          name: d.input.name?.trim() || d.providerAuthConfig.name,
          description: d.input.description?.trim() || d.providerAuthConfig.description,
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
}

export let providerAuthConfigService = Service.create(
  'providerAuthConfig',
  () => new providerAuthConfigServiceImpl()
).build();
