import { v } from '@lowerdeck/validation';
import { solutionPresenter } from '@metorial-subspace/db';
import { solutionService } from '@metorial-subspace/module-tenant';
import { app } from './_app';

export let solutionApp = app.use(async ctx => {
  let solutionId = ctx.body.solutionId;
  if (!solutionId) throw new Error('Solution ID is required');

  let solution = await solutionService.getSolutionById({ id: solutionId });

  return { solution };
});

export let solutionController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let solution = await solutionService.upsertSolution({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return solutionPresenter(solution);
    }),

  get: solutionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        solutionId: v.string()
      })
    )
    .do(async ctx => solutionPresenter(ctx.solution))
});
