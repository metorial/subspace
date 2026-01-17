import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerListingCollectionService } from '@metorial-subspace/module-catalog';
import { providerListingCollectionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerListingCollectionApp = tenantApp.use(async ctx => {
  let providerListingCollectionId = ctx.body.providerListingCollectionId;
  if (!providerListingCollectionId)
    throw new Error('ProviderListingCollection ID is required');

  let providerListingCollection =
    await providerListingCollectionService.getProviderListingCollectionById({
      providerListingCollectionId,
      tenant: ctx.tenant,
      solution: ctx.solution
    });

  return { providerListingCollection };
});

export let providerListingCollectionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerListingIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerListingCollectionService.listProviderListingCollections({
        tenant: ctx.tenant,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        providerListingIds: ctx.input.providerListingIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerListingCollectionPresenter);
    }),

  get: providerListingCollectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerListingCollectionId: v.string()
      })
    )
    .do(async ctx => providerListingCollectionPresenter(ctx.providerListingCollection)),

  upsert: providerListingCollectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        slug: v.string(),
        description: v.string()
      })
    )
    .do(async ctx => {
      let providerListingCollection =
        await providerListingCollectionService.upsertProviderListingCollection({
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            slug: ctx.input.slug
          }
        });

      return providerListingCollectionPresenter(providerListingCollection);
    })
});
