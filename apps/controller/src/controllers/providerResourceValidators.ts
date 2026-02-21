import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import type { TenantSelector } from '@metorial-subspace/list-utils';

export let configSourceValidator = v.union([
  v.object({ type: v.literal('none') }),
  v.object({ type: v.literal('reference'), providerConfigId: v.string() }),
  v.object({
    type: v.literal('new'),
    name: v.optional(v.string()),
    config: v.union([
      v.object({ type: v.literal('new'), data: v.record(v.any()) }),
      v.object({ type: v.literal('vault'), providerConfigVaultId: v.string() })
    ])
  })
]);

export let configValidator = v.union([
  v.object({ type: v.literal('reference'), providerConfigId: v.string() }),
  v.object({
    type: v.literal('new'),
    name: v.optional(v.string()),
    config: v.union([
      v.object({ type: v.literal('new'), data: v.record(v.any()) }),
      v.object({ type: v.literal('vault'), providerConfigVaultId: v.string() })
    ])
  }),
  v.string()
]);

export let deploymentValidator = v.union([
  v.object({ type: v.literal('reference'), providerDeploymentId: v.string() }),
  v.object({
    type: v.literal('new'),
    providerId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.any())),
    lockedProviderVersionId: v.optional(v.string()),
    config: v.optional(configSourceValidator)
  }),
  v.string()
]);

export let authConfigValidator = v.union([
  v.object({ type: v.literal('reference'), providerAuthConfigId: v.string() }),
  v.object({
    type: v.literal('new'),
    name: v.optional(v.string()),
    providerAuthMethodId: v.string(),
    credentials: v.record(v.any())
  }),
  v.string()
]);

type DeploymentInput =
  | string
  | { type: 'reference'; providerDeploymentId: string }
  | {
      type: 'new';
      providerId: string;
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      lockedProviderVersionId?: string;
      config?: ConfigSourceInput;
    };

type ConfigSourceInput =
  | { type: 'none' }
  | { type: 'reference'; providerConfigId: string }
  | {
      type: 'new';
      name?: string;
      config:
        | { type: 'new'; data: Record<string, unknown> }
        | { type: 'vault'; providerConfigVaultId: string };
    };

type ConfigInput =
  | string
  | { type: 'reference'; providerConfigId: string }
  | {
      type: 'new';
      name?: string;
      config:
        | { type: 'new'; data: Record<string, unknown> }
        | { type: 'vault'; providerConfigVaultId: string };
    };

type AuthConfigInput =
  | string
  | { type: 'reference'; providerAuthConfigId: string }
  | {
      type: 'new';
      name?: string;
      providerAuthMethodId: string;
      credentials: Record<string, unknown>;
    };

export let resolveDeploymentConfig = async (
  ctx: TenantSelector,
  config: ConfigSourceInput | null | undefined
) => {
  if (!config || config.type === 'none') {
    return { type: 'none' as const };
  }

  if (config.type === 'reference') {
    let providerConfig = await providerConfigService.getProviderConfigById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerConfigId: config.providerConfigId
    });
    return { type: 'config' as const, config: providerConfig };
  }

  if (config.type === 'new') {
    let innerConfig = config.config;
    if (innerConfig.type === 'new') {
      return { type: 'inline' as const, data: innerConfig.data };
    }
    if (innerConfig.type === 'vault') {
      let vault = await providerConfigVaultService.getProviderConfigVaultById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        providerConfigVaultId: innerConfig.providerConfigVaultId
      });
      return { type: 'vault' as const, vault };
    }
  }

  return { type: 'none' as const };
};

export let resolveDeployment = async (
  ctx: TenantSelector,
  input: DeploymentInput
): Promise<{ id: string; providerId: string }> => {
  if (typeof input === 'string') {
    let d = await providerDeploymentService.getProviderDeploymentById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerDeploymentId: input
    });
    return { id: d.id, providerId: d.provider.id };
  }

  if (input.type === 'reference') {
    let d = await providerDeploymentService.getProviderDeploymentById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerDeploymentId: input.providerDeploymentId
    });
    return { id: d.id, providerId: d.provider.id };
  }

  if (input.type === 'new') {
    let provider = await providerService.getProviderById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerId: input.providerId
    });

    let lockedVersion = input.lockedProviderVersionId
      ? await providerVersionService.getProviderVersionById({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          providerVersionId: input.lockedProviderVersionId
        })
      : undefined;

    let config = await resolveDeploymentConfig(ctx, input.config);

    let d = await providerDeploymentService.createProviderDeployment({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      lockedVersion,
      input: {
        name: input.name ?? `Ephemeral deployment for ${provider.name}`,
        description: input.description,
        metadata: input.metadata,
        config,
        isEphemeral: true
      }
    });

    return { id: d.id, providerId: d.provider.id };
  }

  throw new Error('Invalid deployment input');
};

type ConfigTenantSelector = TenantSelector & {
  providerId: string;
  deploymentId: string;
};

export let resolveConfig = async (
  ctx: ConfigTenantSelector,
  input: ConfigInput | undefined
): Promise<string | undefined> => {
  if (!input) return undefined;

  if (typeof input === 'string') return input;

  if (input.type === 'reference') return input.providerConfigId;

  if (input.type === 'new') {
    if (!ctx.deploymentId) {
      throw new Error(
        'Cannot create inline config without a deployment. Use resolveDeploymentConfig for deployment creation.'
      );
    }

    let provider = await providerService.getProviderById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerId: ctx.providerId
    });

    let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerDeploymentId: ctx.deploymentId
    });

    let config =
      input.config.type === 'new'
        ? { type: 'inline' as const, data: input.config.data }
        : {
            type: 'vault' as const,
            vault: await providerConfigVaultService.getProviderConfigVaultById({
              tenant: ctx.tenant,
              solution: ctx.solution,
              environment: ctx.environment,
              providerConfigVaultId: input.config.providerConfigVaultId
            })
          };

    let c = await providerConfigService.createProviderConfig({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      providerDeployment,
      input: {
        name: input.name ?? 'Ephemeral config',
        config,
        isEphemeral: true
      }
    });

    return c.id;
  }

  return undefined;
};

export let resolveAuthConfig = async (
  ctx: ConfigTenantSelector,
  input: AuthConfigInput | undefined
): Promise<string | undefined> => {
  if (!input) return undefined;

  if (typeof input === 'string') return input;

  if (input.type === 'reference') return input.providerAuthConfigId;

  if (input.type === 'new') {
    if (!ctx.deploymentId) {
      throw new Error('Cannot create inline auth config without a deployment.');
    }

    let provider = await providerService.getProviderById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerId: ctx.providerId
    });

    let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerDeploymentId: ctx.deploymentId
    });

    let ac = await providerAuthConfigService.createProviderAuthConfig({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      providerDeployment,
      source: 'manual',
      import: {
        ip: undefined,
        ua: undefined,
        note: 'Created via inline provider configuration'
      },
      input: {
        name: input.name ?? 'Ephemeral auth config',
        authMethodId: input.providerAuthMethodId,
        config: input.credentials,
        isEphemeral: true
      }
    });

    return ac.id;
  }

  return undefined;
};
