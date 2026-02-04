import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmAccountPreviewPresenter,
  scmRepositoryPresenter,
  scmRepositoryPreviewPresenter,
  scmRepositoryService
} from '@metorial-subspace/module-custom-provider';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmRepositoryApp = tenantApp.use(async ctx => {
  let scmRepositoryId = ctx.body.scmRepositoryId;
  if (!scmRepositoryId) throw new Error('ScmRepository ID is required');

  let scmRepository = await scmRepositoryService.getScmRepositoryById({
    scmRepositoryId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { scmRepository };
});

export let scmRepositoryController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await scmRepositoryService.listScmRepositories({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        customProviderIds: ctx.input.customProviderIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, scmRepositoryPresenter);
    }),

  get: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmRepositoryId: v.string()
      })
    )
    .do(async ctx => scmRepositoryPresenter(ctx.scmRepository)),

  listAccountPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmConnectionId: v.string()
      })
    )
    .do(async ctx => {
      let items = await scmRepositoryService.listScmAccountPreviews({
        tenant: ctx.tenant,
        input: {
          scmConnectionId: ctx.input.scmConnectionId
        }
      });

      return items.accounts.map(item => scmAccountPreviewPresenter(item));
    }),

  listRepositoryPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmConnectionId: v.string(),
        externalAccountId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let items = await scmRepositoryService.listScmRepositoryPreviews({
        tenant: ctx.tenant,
        input: {
          scmConnectionId: ctx.input.scmConnectionId,
          externalAccountId: ctx.input.externalAccountId
        }
      });

      return items.repositories.map(item => scmRepositoryPreviewPresenter(item));
    })
});
