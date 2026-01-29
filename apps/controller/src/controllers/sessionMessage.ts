import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionMessageService } from '@metorial-subspace/module-session';
import { sessionMessagePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let sessionMessageApp = tenantApp.use(async ctx => {
  let sessionMessageId = ctx.body.sessionMessageId;
  if (!sessionMessageId) throw new Error('SessionMessage ID is required');

  let sessionMessage = await sessionMessageService.getSessionMessageById({
    sessionMessageId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { sessionMessage };
});

export let sessionMessageController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          types: v.optional(v.array(v.enumOf(['unknown', 'tool_call', 'mcp_control']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          sessionConnectionIds: v.optional(v.array(v.string())),
          providerRunIds: v.optional(v.array(v.string())),
          errorIds: v.optional(v.array(v.string())),
          participantIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await sessionMessageService.listSessionMessages({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        types: ctx.input.types,

        ids: ctx.input.ids,
        sessionIds: ctx.input.sessionIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        sessionConnectionIds: ctx.input.sessionConnectionIds,
        providerRunIds: ctx.input.providerRunIds,
        errorIds: ctx.input.errorIds,
        participantIds: ctx.input.participantIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, sessionMessagePresenter);
    }),

  get: sessionMessageApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        sessionMessageId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => sessionMessagePresenter(ctx.sessionMessage))
});
