import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthMethodPresenter } from '@metorial-subspace/db';
import { providerAuthMethodService } from '@metorial-subspace/module-catalog';
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
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerAuthMethodService.listProviderAuthMethods({
        tenant: ctx.tenant,
        solution: ctx.solution
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
