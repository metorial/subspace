import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionService } from '@metorial-subspace/module-session';
import { sessionPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { toolFiltersValidator } from './sessionProvider';
import { tenantApp } from './tenant';

export let sessionApp = tenantApp.use(async ctx => {
  let sessionId = ctx.body.sessionId;
  if (!sessionId) throw new Error('Session ID is required');

  let session = await sessionService.getSessionById({
    sessionId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { session };
});

export let sessionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionService.listSessions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        sessionTemplateIds: ctx.input.sessionTemplateIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionPresenter);
    }),

  get: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionPresenter(ctx.session)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        providers: v.array(
          v.object({
            providerDeploymentId: v.optional(v.string()),
            providerConfigId: v.optional(v.string()),
            providerAuthConfigId: v.optional(v.string()),

            sessionTemplateId: v.optional(v.string()),

            toolFilters: toolFiltersValidator
          })
        )
      })
    )
    .do(async ctx => {
      let session = await sessionService.createSession({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          providers: ctx.input.providers.map(p => ({
            deploymentId: p.providerDeploymentId,
            configId: p.providerConfigId,
            authConfigId: p.providerAuthConfigId,
            toolFilters: p.toolFilters as any,
            sessionTemplateId: p.sessionTemplateId
          }))
        }
      });

      return sessionPresenter(session);
    }),

  update: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionId: v.string(),

        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let session = await sessionService.updateSession({
        session: ctx.session,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return sessionPresenter(session);
    })
});
