import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import type { TenantSelector } from '@metorial-subspace/list-utils';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';

type AuthConfigTenantSelector = TenantSelector & {
  providerId: string;
  deploymentId: string;
  ip?: string;
  ua?: string;
};

export let authConfigValidator = v.union([
  v.object({ type: v.literal('reference'), providerAuthConfigId: v.string() }),
  v.object({
    type: v.literal('ephemeral'),
    name: v.optional(v.string()),
    providerAuthMethodId: v.string(),
    credentials: v.record(v.any())
  })
]);

type AuthConfigInput = ValidationTypeValue<typeof authConfigValidator>;

export let resolveAuthConfig = async (
  ctx: AuthConfigTenantSelector,
  input: AuthConfigInput | undefined | null
): Promise<string | undefined> => {
  if (!input) return undefined;

  if (input.type === 'reference') return input.providerAuthConfigId;

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

    let ac = await providerAuthConfigService.createProviderAuthConfig({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      provider,
      providerDeployment,
      source: 'manual',
      import: {
        ip: ctx.ip,
        ua: ctx.ua,
        note: 'Created via ephemeral provider configuration'
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
