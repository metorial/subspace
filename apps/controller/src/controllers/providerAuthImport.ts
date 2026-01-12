import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthImportPresenter } from '@metorial-subspace/db';
import {
  providerAuthConfigService,
  providerAuthImportService
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerAuthImportApp = tenantApp.use(async ctx => {
  let providerAuthImportId = ctx.body.providerAuthImportId;
  if (!providerAuthImportId) throw new Error('ProviderAuthImport ID is required');

  let providerAuthImport = await providerAuthImportService.getProviderAuthImportById({
    providerAuthImportId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerAuthImport };
});

export let providerAuthImportController = app.controller({
  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await providerAuthImportService.listProviderAuthImports({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthImportPresenter);
    }),

  get: providerAuthImportApp
    .handler()
    .input(
      v.object({
        providerAuthImportId: v.string()
      })
    )
    .do(async ctx => providerAuthImportPresenter(ctx.providerAuthImport)),

  create: providerAuthImportApp
    .handler()
    .input(
      v.object({
        note: v.string(),
        metadata: v.optional(v.record(v.any())),

        providerId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string()),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let provider = ctx.input.providerId
        ? await providerService.getProviderById({
            providerId: ctx.input.providerId,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            tenant: ctx.tenant,
            solution: ctx.solution,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;

      let providerAuthConfig = ctx.input.providerAuthConfigId
        ? await providerAuthConfigService.getProviderAuthConfigById({
            tenant: ctx.tenant,
            solution: ctx.solution,
            providerAuthConfigId: ctx.input.providerAuthConfigId
          })
        : undefined;

      let providerAuthImport = await providerAuthImportService.createProviderAuthImport({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerAuthConfig,

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          ip: ctx.context.ip,
          ua: ctx.context.ua,
          note: ctx.input.note,
          metadata: ctx.input.metadata,

          config: ctx.input.config
        }
      });

      return providerAuthImportPresenter(providerAuthImport);
    })
});
