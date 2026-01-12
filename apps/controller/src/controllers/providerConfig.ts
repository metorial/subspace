import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerConfigPresenter, providerConfigSchemaPresenter } from '@metorial-subspace/db';
import {
  providerConfigSchemaService,
  providerService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerConfigApp = tenantApp.use(async ctx => {
  let providerConfigId = ctx.body.providerConfigId;
  if (!providerConfigId) throw new Error('ProviderConfig ID is required');

  let providerConfig = await providerConfigService.getProviderConfigById({
    providerConfigId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerConfig };
});

export let providerConfigController = app.controller({
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
      let paginator = await providerConfigService.listProviderConfigs({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerConfigPresenter);
    }),

  getConfigSchema: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerId: v.optional(v.string()),
        providerConfigId: v.optional(v.string()),
        providerVersionId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let ts = { tenant: ctx.tenant, solution: ctx.solution };
      let provider = ctx.input.providerId
        ? await providerService.getProviderById({
            ...ts,
            providerId: ctx.input.providerId
          })
        : undefined;
      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            ...ts,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;
      let providerConfig = ctx.input.providerConfigId
        ? await providerConfigService.getProviderConfigById({
            ...ts,
            providerConfigId: ctx.input.providerConfigId
          })
        : undefined;
      let providerVersion = ctx.input.providerVersionId
        ? await providerVersionService.getProviderVersionById({
            ...ts,
            providerVersionId: ctx.input.providerVersionId
          })
        : undefined;

      let config = await providerConfigSchemaService.getProviderConfigSchema({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,
        providerConfig,
        providerVersion
      });

      return providerConfigSchemaPresenter(config);
    }),

  get: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerConfigId: v.string()
      })
    )
    .do(async ctx => providerConfigPresenter(ctx.providerConfig)),

  create: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),

        config: v.union([
          v.object({
            type: v.literal('inline'),
            data: v.record(v.any())
          }),
          v.object({
            type: v.literal('vault'),
            providerConfigVaultId: v.string()
          })
        ])
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            providerDeploymentId: ctx.input.providerDeploymentId,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;

      let providerConfig = await providerConfigService.createProviderConfig({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          isEphemeral: ctx.input.isEphemeral,

          config:
            ctx.input.config.type == 'vault'
              ? {
                  type: 'vault',
                  vault: await providerConfigVaultService.getProviderConfigVaultById({
                    providerConfigVaultId: ctx.input.config.providerConfigVaultId,
                    tenant: ctx.tenant,
                    solution: ctx.solution
                  })
                }
              : {
                  type: 'inline',
                  data: ctx.input.config.data
                }
        }
      });

      return providerConfigPresenter(providerConfig);
    }),

  update: providerConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerConfigId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerConfig = await providerConfigService.updateProviderConfig({
        providerConfig: ctx.providerConfig,
        tenant: ctx.tenant,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerConfigPresenter(providerConfig);
    })
});
