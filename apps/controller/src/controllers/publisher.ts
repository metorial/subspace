import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { publisherPresenter } from '@metorial-subspace/db';
import { publisherService } from '@metorial-subspace/module-catalog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let publisherApp = tenantApp.use(async ctx => {
  let publisherId = ctx.body.publisherId;
  if (!publisherId) throw new Error('Publisher ID is required');

  let publisher = await publisherService.getPublisherById({
    publisherId,
    tenant: ctx.tenant
  });

  return { publisher };
});

export let publisherController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await publisherService.listPublishers({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, publisherPresenter);
    }),

  get: publisherApp
    .handler()
    .input(
      v.object({
        publisherId: v.string()
      })
    )
    .do(async ctx => publisherPresenter(ctx.publisher))
});
