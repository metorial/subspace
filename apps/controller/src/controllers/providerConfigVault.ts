import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerConfigVaultPresenter } from '@metorial-subspace/db';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerConfigVaultApp = tenantApp.use(async ctx => {
  let providerConfigVaultId = ctx.body.providerConfigVaultId;
  if (!providerConfigVaultId) throw new Error('ProviderConfigVault ID is required');

  let providerConfigVault = await providerConfigVaultService.getProviderConfigVaultById({
    providerConfigVaultId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerConfigVault };
});

export let providerConfigVaultController = app.controller({
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
      let paginator = await providerConfigVaultService.listProviderConfigVaults({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerConfigVaultPresenter);
    }),

  get: providerConfigVaultApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerConfigVaultId: v.string()
      })
    )
    .do(async ctx => providerConfigVaultPresenter(ctx.providerConfigVault)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        providerId: v.string(),
        providerDeploymentId: v.optional(v.string()),

        config: v.object({
          type: v.literal('inline'),
          data: v.record(v.any())
        })
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

      let providerConfigVault = await providerConfigVaultService.createProviderConfigVault({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          config: {
            type: 'inline',
            data: ctx.input.config.data
          }
        }
      });

      return providerConfigVaultPresenter(providerConfigVault);
    }),

  update: providerConfigVaultApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerConfigVaultId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerConfigVault = await providerConfigVaultService.updateProviderConfigVault({
        providerConfigVault: ctx.providerConfigVault,
        tenant: ctx.tenant,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerConfigVaultPresenter(providerConfigVault);
    })
});
