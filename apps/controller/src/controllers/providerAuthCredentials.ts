import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthCredentialsPresenter } from '@metorial-subspace/db';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerAuthCredentialsApp = tenantApp.use(async ctx => {
  let providerAuthCredentialsId = ctx.body.providerAuthCredentialsId;
  if (!providerAuthCredentialsId) throw new Error('ProviderAuthCredentials ID is required');

  let providerAuthCredentials =
    await providerAuthCredentialsService.getProviderAuthCredentialsById({
      providerAuthCredentialsId,
      tenant: ctx.tenant,
      solution: ctx.solution
    });

  return { providerAuthCredentials };
});

export let providerAuthCredentialsController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerAuthCredentialsService.listProviderAuthCredentials({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthCredentialsPresenter);
    }),

  get: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        providerAuthCredentialsId: v.string()
      })
    )
    .do(async ctx => providerAuthCredentialsPresenter(ctx.providerAuthCredentials)),

  create: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),

        config: v.object({
          type: v.literal('oauth'),
          clientId: v.string(),
          clientSecret: v.string(),
          scopes: v.array(v.string())
        })
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let providerAuthCredentials =
        await providerAuthCredentialsService.createProviderAuthCredentials({
          tenant: ctx.tenant,
          solution: ctx.solution,

          provider,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            isEphemeral: ctx.input.isEphemeral,
            config: ctx.input.config
          }
        });

      return providerAuthCredentialsPresenter(providerAuthCredentials);
    }),

  update: providerAuthCredentialsApp
    .handler()
    .input(
      v.object({
        providerAuthCredentialsId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerAuthCredentials =
        await providerAuthCredentialsService.updateProviderAuthCredentials({
          providerAuthCredentials: ctx.providerAuthCredentials,
          tenant: ctx.tenant,
          solution: ctx.solution,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata
          }
        });

      return providerAuthCredentialsPresenter(providerAuthCredentials);
    })
});
