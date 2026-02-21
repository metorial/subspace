import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';

export let configValidator = v.union([
  v.object({ type: v.literal('reference'), providerConfigId: v.string() }),
  v.object({
    type: v.literal('ephemeral'),
    name: v.optional(v.string()),
    config: v.union([
      v.object({ type: v.literal('inline'), data: v.record(v.any()) }),
      v.object({ type: v.literal('vault'), providerConfigVaultId: v.string() })
    ])
  })
]);

export let configSourceValidator = v.union([
  v.object({ type: v.literal('none') }),
  configValidator
]);

type ConfigSourceInput = ValidationTypeValue<typeof configSourceValidator>;

export type ConfigTenantSelector = TenantSelector & {
  providerId: string;
  deploymentId: string;
};

export let resolveConfigSource = async (
  ctx: TenantSelector,
  config: ConfigSourceInput | null | undefined
) => {
  if (config?.type === 'reference') {
    let providerConfig = await providerConfigService.getProviderConfigById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      providerConfigId: config.providerConfigId
    });
    return { type: 'config' as const, config: providerConfig };
  }

  if (config?.type === 'ephemeral') {
    let innerConfig = config.config;
    if (innerConfig.type === 'inline') {
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

export let resolveConfig = async (
  ctx: ConfigTenantSelector,
  input: ValidationTypeValue<typeof configValidator> | undefined | null
): Promise<string | undefined> => {
  if (!input) return undefined;

  if (input.type === 'reference') return input.providerConfigId;

  if (input.type === 'ephemeral') {
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
      input.config.type === 'inline'
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
