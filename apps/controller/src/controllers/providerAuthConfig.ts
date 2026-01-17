import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { providerAuthConfigPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerAuthConfigApp = tenantApp.use(async ctx => {
  let providerAuthConfigId = ctx.body.providerAuthConfigId;
  if (!providerAuthConfigId) throw new Error('ProviderAuthConfig ID is required');

  let providerAuthConfig = await providerAuthConfigService.getProviderAuthConfigById({
    providerAuthConfigId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerAuthConfig };
});

export let providerAuthConfigController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthConfigService.listProviderAuthConfigs({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthConfigPresenter);
    }),

  get: providerAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthConfigId: v.string()
      })
    )
    .do(async ctx => providerAuthConfigPresenter(ctx.providerAuthConfig)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        ip: v.string(),
        ua: v.string(),

        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),
        providerAuthMethodId: v.string(),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            tenant: ctx.tenant,
            solution: ctx.solution,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;

      let providerAuthConfig = await providerAuthConfigService.createProviderAuthConfig({
        tenant: ctx.tenant,
        solution: ctx.solution,

        source: 'manual',

        provider,
        providerDeployment,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          isEphemeral: ctx.input.isEphemeral,
          config: ctx.input.config
        }
      });

      return providerAuthConfigPresenter(providerAuthConfig);
    }),

  update: providerAuthConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthConfigId: v.string(),

        ip: v.string(),
        ua: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerAuthConfig = await providerAuthConfigService.updateProviderAuthConfig({
        providerAuthConfig: ctx.providerAuthConfig,
        tenant: ctx.tenant,
        solution: ctx.solution,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerAuthConfigPresenter(providerAuthConfig);
    })
});
