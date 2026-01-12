import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerListingCategoryPresenter } from '@metorial-subspace/db';
import { providerListingCategoryService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerListingCategoryApp = tenantApp.use(async ctx => {
  let providerListingCategoryId = ctx.body.providerListingCategoryId;
  if (!providerListingCategoryId) throw new Error('ProviderListingCategory ID is required');

  let providerListingCategory =
    await providerListingCategoryService.getProviderListingCategoryById({
      providerListingCategoryId,
      tenant: ctx.tenant,
      solution: ctx.solution
    });

  return { providerListingCategory };
});

export let providerListingCategoryController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerListingCategoryService.listProviderListingCategories({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerListingCategoryPresenter);
    }),

  get: providerListingCategoryApp
    .handler()
    .input(
      v.object({
        providerListingCategoryId: v.string()
      })
    )
    .do(async ctx => providerListingCategoryPresenter(ctx.providerListingCategory)),

  upsert: providerListingCategoryApp
    .handler()
    .input(
      v.object({
        name: v.string(),
        slug: v.string(),
        description: v.string()
      })
    )
    .do(async ctx => {
      let providerListingCategory =
        await providerListingCategoryService.upsertProviderListingCategory({
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            slug: ctx.input.slug
          }
        });

      return providerListingCategoryPresenter(providerListingCategory);
    })
});
