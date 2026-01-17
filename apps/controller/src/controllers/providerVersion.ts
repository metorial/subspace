import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerVersionService } from '@metorial-subspace/module-catalog';
import { providerVersionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerVersionApp = tenantApp.use(async ctx => {
  let providerVersionId = ctx.body.providerVersionId;
  if (!providerVersionId) throw new Error('ProviderVersion ID is required');

  let providerVersion = await providerVersionService.getProviderVersionById({
    providerVersionId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerVersion };
});

export let providerVersionController = app.controller({
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
      let paginator = await providerVersionService.listProviderVersions({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerVersionPresenter);
    }),

  get: providerVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerVersionId: v.string()
      })
    )
    .do(async ctx => providerVersionPresenter(ctx.providerVersion))
});
