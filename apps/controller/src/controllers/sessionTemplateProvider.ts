import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  sessionTemplateProviderService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { sessionTemplateProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let sessionTemplateProviderApp = tenantApp.use(async ctx => {
  let sessionTemplateProviderId = ctx.body.sessionTemplateProviderId;
  if (!sessionTemplateProviderId) throw new Error('SessionTemplateProvider ID is required');

  let sessionTemplateProvider =
    await sessionTemplateProviderService.getSessionTemplateProviderById({
      sessionTemplateProviderId,
      tenant: ctx.tenant,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { sessionTemplateProvider };
});

export let toolFiltersValidator = v.nullable(
  v.optional(
    v.object({
      toolKeys: v.optional(v.array(v.string()))
    })
  )
);

export let sessionTemplateProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'inactive']))),

          ids: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
          sessionTemplateTemplateIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionTemplateProviderService.listSessionTemplateProviders({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionTemplateProviderPresenter);
    }),

  get: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionTemplateProviderPresenter(ctx.sessionTemplateProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        sessionTemplateId: v.string(),

        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionTemplate = await sessionTemplateService.getSessionTemplateById({
        tenant: ctx.tenant,
        solution: ctx.solution,
        sessionTemplateId: ctx.input.sessionTemplateId
      });

      let sessionTemplateProvider =
        await sessionTemplateProviderService.createSessionTemplateProvider({
          tenant: ctx.tenant,
          solution: ctx.solution,
          template: sessionTemplate,

          input: {
            deploymentId: ctx.input.providerDeploymentId,
            configId: ctx.input.providerConfigId,
            authConfigId: ctx.input.providerAuthConfigId,

            toolFilters: ctx.input.toolFilters
          }
        });

      return sessionTemplateProviderPresenter(sessionTemplateProvider);
    }),

  update: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionTemplateProvider =
        await sessionTemplateProviderService.updateSessionTemplateProvider({
          sessionTemplateProvider: ctx.sessionTemplateProvider,
          tenant: ctx.tenant,
          solution: ctx.solution,

          input: {
            toolFilters: ctx.input.toolFilters
          }
        });

      return sessionTemplateProviderPresenter(sessionTemplateProvider);
    }),

  delete: sessionTemplateProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionTemplateProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      await sessionTemplateProviderService.deleteSessionTemplateProvider({
        sessionTemplateProvider: ctx.sessionTemplateProvider,
        tenant: ctx.tenant,
        solution: ctx.solution
      });
    })
});
