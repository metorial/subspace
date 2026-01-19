import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import {
  providerAuthMethodService,
  providerService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerAuthMethodPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerAuthMethodApp = tenantApp.use(async ctx => {
  let providerAuthMethodId = ctx.body.providerAuthMethodId;
  if (!providerAuthMethodId) throw new Error('ProviderAuthMethod ID is required');

  let providerAuthMethod = await providerAuthMethodService.getProviderAuthMethodById({
    providerAuthMethodId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerAuthMethod };
});

export let providerAuthMethodController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          providerId: v.optional(v.string()),
          providerVersion: v.optional(v.string()),
          providerDeployment: v.optional(v.string()),
          providerConfig: v.optional(v.string()),
          providerAuthConfig: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let provider = ctx.input.providerId
        ? await providerService.getProviderById({
            providerId: ctx.input.providerId,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;
      let providerVersion = ctx.input.providerVersion
        ? await providerVersionService.getProviderVersionById({
            providerVersionId: ctx.input.providerVersion,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;
      let providerDeployment = ctx.input.providerDeployment
        ? await providerDeploymentService.getProviderDeploymentById({
            providerDeploymentId: ctx.input.providerDeployment,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;
      let providerConfig = ctx.input.providerConfig
        ? await providerConfigService.getProviderConfigById({
            providerConfigId: ctx.input.providerConfig,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;
      let providerAuthConfig = ctx.input.providerAuthConfig
        ? await providerAuthConfigService.getProviderAuthConfigById({
            providerAuthConfigId: ctx.input.providerAuthConfig,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;

      let paginator = await providerAuthMethodService.listProviderAuthMethods({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerVersion,
        providerDeployment,
        providerConfig,
        providerAuthConfig
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthMethodPresenter);
    }),

  get: providerAuthMethodApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthMethodId: v.string()
      })
    )
    .do(async ctx => providerAuthMethodPresenter(ctx.providerAuthMethod))
});
