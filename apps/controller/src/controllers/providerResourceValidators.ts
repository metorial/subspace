import { v } from '@lowerdeck/validation';
import {
  providerConfigService,
  providerConfigVaultService
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
