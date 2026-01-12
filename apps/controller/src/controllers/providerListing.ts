import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerListingPresenter } from '@metorial-subspace/db';
import { providerListingService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerListingApp = tenantApp.use(async ctx => {
  let providerListingId = ctx.body.providerListingId;
  if (!providerListingId) throw new Error('ProviderListing ID is required');

  let providerListing = await providerListingService.getProviderListingById({
    providerListingId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerListing };
});

export let providerListingController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string()),

          collectionIds: v.optional(v.array(v.string())),
          categoryIds: v.optional(v.array(v.string())),
          publisherIds: v.optional(v.array(v.string())),

          isPublic: v.optional(v.boolean()),
          onlyFormTenant: v.optional(v.boolean()),

          isVerified: v.optional(v.boolean()),
          isOfficial: v.optional(v.boolean()),
          isMetorial: v.optional(v.boolean()),

          orderByRank: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerListingService.listProviderListings({
        tenant: ctx.tenant,
        solution: ctx.solution,

        search: ctx.input.search,

        collectionIds: ctx.input.collectionIds,
        categoryIds: ctx.input.categoryIds,
        publisherIds: ctx.input.publisherIds,

        isPublic: ctx.input.isPublic,
        onlyFromTenant: ctx.input.onlyFormTenant,

        isVerified: ctx.input.isVerified,
        isOfficial: ctx.input.isOfficial,
        isMetorial: ctx.input.isMetorial,

        orderByRank: ctx.input.orderByRank
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerListingPresenter);
    }),

  get: providerListingApp
    .handler()
    .input(
      v.object({
        providerListingId: v.string()
      })
    )
    .do(async ctx => providerListingPresenter(ctx.providerListing))
});
