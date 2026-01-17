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
    solution: ctx.solution
  });

  return { session };
});

export let sessionController = app.controller({
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
      let paginator = await sessionService.listSessions({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionPresenter);
    }),

  get: sessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        sessionId: v.string()
      })
    )
    .do(async ctx => sessionPresenter(ctx.session)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        providers: v.array(
          v.object({
            providerDeploymentId: v.optional(v.string()),
            providerConfigId: v.optional(v.string()),
            providerAuthConfigId: v.optional(v.string()),

            toolFilters: toolFiltersValidator
          })
        )
      })
    )
    .do(async ctx => {
      let session = await sessionService.createSession({
        tenant: ctx.tenant,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          providers: ctx.input.providers.map(p => ({
            deploymentId: p.providerDeploymentId,
            configId: p.providerConfigId,
            authConfigId: p.providerAuthConfigId,
            toolFilters: p.toolFilters
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
        sessionId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let session = await sessionService.updateSession({
        session: ctx.session,
        tenant: ctx.tenant,
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
