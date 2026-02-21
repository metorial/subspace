import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import {
  providerConfigService,
  providerConfigVaultService
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

export let resolveDeploymentConfig = async (
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
