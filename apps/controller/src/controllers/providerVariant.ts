import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerVariantPresenter } from '@metorial-subspace/db';
import { providerVariantService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerVariantApp = tenantApp.use(async ctx => {
  let providerVariantId = ctx.body.providerVariantId;
  if (!providerVariantId) throw new Error('ProviderVariant ID is required');

  let providerVariant = await providerVariantService.getProviderVariantById({
    providerVariantId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerVariant };
});

export let providerVariantController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerVariantService.listProviderVariants({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerVariantPresenter);
    }),

  get: providerVariantApp
    .handler()
    .input(
      v.object({
        providerVariantId: v.string()
      })
    )
    .do(async ctx => providerVariantPresenter(ctx.providerVariant))
});
