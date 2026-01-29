import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionProviderService, sessionService } from '@metorial-subspace/module-session';
import { sessionProviderPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let sessionProviderApp = tenantApp.use(async ctx => {
  let sessionProviderId = ctx.body.sessionProviderId;
  if (!sessionProviderId) throw new Error('SessionProvider ID is required');

  let sessionProvider = await sessionProviderService.getSessionProviderById({
    sessionProviderId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionProvider };
});

export let toolFiltersValidator = v.nullable(
  v.optional(
    v.object({
      toolKeys: v.optional(v.array(v.string()))
    })
  )
);

export let sessionProviderController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          allowDeleted: v.optional(v.boolean()),
          status: v.optional(v.array(v.enumOf(['active', 'archived']))),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionProviderService.listSessionProviders({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionProviderPresenter);
    }),

  get: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionProviderPresenter(ctx.sessionProvider)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        sessionId: v.string(),

        providerDeploymentId: v.optional(v.string()),
        providerConfigId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let session = await sessionService.getSessionById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        sessionId: ctx.input.sessionId
      });

      let sessionProvider = await sessionProviderService.createSessionProvider({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        session,

        input: {
          deploymentId: ctx.input.providerDeploymentId,
          configId: ctx.input.providerConfigId,
          authConfigId: ctx.input.providerAuthConfigId,

          toolFilters: ctx.input.toolFilters
        }
      });

      return sessionProviderPresenter(sessionProvider);
    }),

  update: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        toolFilters: toolFiltersValidator
      })
    )
    .do(async ctx => {
      let sessionProvider = await sessionProviderService.updateSessionProvider({
        sessionProvider: ctx.sessionProvider,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          toolFilters: ctx.input.toolFilters
        }
      });

      return sessionProviderPresenter(sessionProvider);
    }),

  delete: sessionProviderApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionProviderId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let sessionProvider = await sessionProviderService.archiveSessionProvider({
        sessionProvider: ctx.sessionProvider,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      return sessionProviderPresenter(sessionProvider);
    })
});
