import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerPresenter } from '@metorial-subspace/db';
import { providerService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerApp = tenantApp.use(async ctx => {
  let providerId = ctx.body.providerId;
  if (!providerId) throw new Error('Provider ID is required');

  let provider = await providerService.getProviderById({
    providerId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { provider };
});

export let providerController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerService.listProviders({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerPresenter);
    }),

  get: providerApp
    .handler()
    .input(
      v.object({
        providerId: v.string()
      })
    )
    .do(async ctx => providerPresenter(ctx.provider)),

  update: providerApp
    .handler()
    .input(
      v.object({
        providerId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        slug: v.optional(v.string()),
        image: v.optional(v.any()),
        skills: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let provider = await providerService.updateProvider({
        provider: ctx.provider,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          slug: ctx.input.slug,
          image: ctx.input.image,
          skills: ctx.input.skills
        }
      });

      return providerPresenter(provider);
    })
});
