import { v } from '@lowerdeck/validation';
import { providerRunLogsService } from '@metorial-subspace/module-session';
import { solutionService, tenantService } from '@metorial-subspace/module-tenant';
import { app } from './_app';

let tenantApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('Tenant ID is required');

  let solutionId = ctx.body.solutionId;
  if (!solutionId) throw new Error('Solution ID is required');

  let tenant = await tenantService.getTenantById({ id: tenantId });
  let solution = await solutionService.getSolutionById({ id: solutionId });

  return { tenant, solution };
});

export let providerRunLogsController = app.controller({
  getLogs: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        solutionId: v.string(),
        providerRunId: v.string()
      })
    )
    .do(async ctx =>
      providerRunLogsService.getProviderRunLogs({
        tenant: ctx.tenant,
        solution: ctx.solution,
        providerRunId: ctx.input.providerRunId
      })
    )
});
