import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthImportPresenter,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
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

let getCreateData = async (d: {
  tenant: Tenant;
  solution: Solution;
  providerId?: string;
  providerDeploymentId?: string;
  providerAuthConfigId?: string;
}) => {
  let provider = d.providerId
    ? await providerService.getProviderById({
        providerId: d.providerId,
        tenant: d.tenant,
        solution: d.solution
      })
    : undefined;
  let providerDeployment = d.providerDeploymentId
    ? await providerDeploymentService.getProviderDeploymentById({
        tenant: d.tenant,
        solution: d.solution,
        providerDeploymentId: d.providerDeploymentId
      })
    : undefined;
  let providerAuthConfig = d.providerAuthConfigId
    ? await providerAuthConfigService.getProviderAuthConfigById({
        tenant: d.tenant,
        solution: d.solution,
        providerAuthConfigId: d.providerAuthConfigId
      })
    : undefined;

  return { provider, providerDeployment, providerAuthConfig };
};

export let providerAuthImportController = app.controller({
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
      let paginator = await providerAuthImportService.listProviderAuthImports({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthImportPresenter);
    }),

  getSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let { provider, providerDeployment, providerAuthConfig } = await getCreateData({
        tenant: ctx.tenant,
        solution: ctx.solution,
        providerId: ctx.input.providerId,
        providerDeploymentId: ctx.input.providerDeploymentId,
        providerAuthConfigId: ctx.input.providerAuthConfigId
      });

      let schema = await providerAuthImportService.getProviderAuthImportSchema({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerAuthConfig,

        input: {
          authMethodId: ctx.input.providerAuthMethodId
        }
      });

      return {
        schema
      };
    }),

  get: providerAuthImportApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthImportId: v.string()
      })
    )
    .do(async ctx => providerAuthImportPresenter(ctx.providerAuthImport)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthConfigId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string()),

        note: v.string(),
        metadata: v.optional(v.record(v.any())),

        ip: v.string(),
        ua: v.string(),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let { provider, providerDeployment, providerAuthConfig } = await getCreateData({
        tenant: ctx.tenant,
        solution: ctx.solution,
        providerId: ctx.input.providerId,
        providerDeploymentId: ctx.input.providerDeploymentId,
        providerAuthConfigId: ctx.input.providerAuthConfigId
      });

      let providerAuthImport = await providerAuthImportService.createProviderAuthImport({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerAuthConfig,

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          ip: ctx.input.ip,
          ua: ctx.input.ua,
          note: ctx.input.note,
          metadata: ctx.input.metadata,

          config: ctx.input.config
        }
      });

      return providerAuthImportPresenter(providerAuthImport);
    })
});
