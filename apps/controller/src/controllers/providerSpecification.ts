import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerSpecificationPresenter } from '@metorial-subspace/db';
import { providerSpecificationService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerSpecificationApp = tenantApp.use(async ctx => {
  let providerSpecificationId = ctx.body.providerSpecificationId;
  if (!providerSpecificationId) throw new Error('ProviderSpecification ID is required');

  let providerSpecification = await providerSpecificationService.getProviderSpecificationById({
    providerSpecificationId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerSpecification };
});

export let providerSpecificationController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerSpecificationService.listProviderSpecifications({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerSpecificationPresenter);
    }),

  get: providerSpecificationApp
    .handler()
    .input(
      v.object({
        providerSpecificationId: v.string()
      })
    )
    .do(async ctx => providerSpecificationPresenter(ctx.providerSpecification))
});
