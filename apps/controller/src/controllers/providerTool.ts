import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import {
  providerService,
  providerToolService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerToolPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerToolApp = tenantApp.use(async ctx => {
  let providerToolId = ctx.body.providerToolId;
  if (!providerToolId) throw new Error('ProviderTool ID is required');

  let providerTool = await providerToolService.getProviderToolById({
    providerToolId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerTool };
});

export let providerToolController = app.controller({
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

      let paginator = await providerToolService.listProviderTools({
        tenant: ctx.tenant,
        solution: ctx.solution,
        provider,
        providerVersion,
        providerDeployment,
        providerConfig,
        providerAuthConfig
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerToolPresenter);
    }),

  get: providerToolApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerToolId: v.string()
      })
    )
    .do(async ctx => providerToolPresenter(ctx.providerTool))
});
