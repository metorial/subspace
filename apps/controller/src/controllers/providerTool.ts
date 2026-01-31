import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerToolService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { providerToolPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerToolApp = tenantApp.use(async ctx => {
  let providerToolId = ctx.body.providerToolId;
  if (!providerToolId) throw new Error('ProviderTool ID is required');

  let providerTool = await providerToolService.getProviderToolById({
    providerToolId,
    tenant: ctx.tenant,
    environment: ctx.environment,
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
          environmentId: v.string(),

          providerVersion: v.string()
        })
      )
    )
    .do(async ctx => {
      let providerVersion = await providerVersionService.getProviderVersionById({
        providerVersionId: ctx.input.providerVersion,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let paginator = await providerToolService.listProviderTools({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerVersion
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerToolPresenter);
    }),

  get: providerToolApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerToolId: v.string()
      })
    )
    .do(async ctx => providerToolPresenter(ctx.providerTool))
});
