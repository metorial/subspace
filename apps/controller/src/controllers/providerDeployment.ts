import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerDeploymentPresenter } from '@metorial-subspace/db';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerDeploymentApp = tenantApp.use(async ctx => {
  let providerDeploymentId = ctx.body.providerDeploymentId;
  if (!providerDeploymentId) throw new Error('ProviderDeployment ID is required');

  let providerDeployment = await providerDeploymentService.getProviderDeploymentById({
    providerDeploymentId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerDeployment };
});

export let providerDeploymentController = app.controller({
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
      let paginator = await providerDeploymentService.listProviderDeployments({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerDeploymentPresenter);
    }),

  get: providerDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerDeploymentId: v.string()
      })
    )
    .do(async ctx => providerDeploymentPresenter(ctx.providerDeployment)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),
        lockedProviderVersionId: v.optional(v.string()),

        config: v.union([
          v.object({
            type: v.literal('none')
          }),
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

      let lockedVersion = ctx.input.lockedProviderVersionId
        ? await providerVersionService.getProviderVersionById({
            providerVersionId: ctx.input.lockedProviderVersionId,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;

      let providerDeployment = await providerDeploymentService.createProviderDeployment({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        lockedVersion,

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
              : ctx.input.config
        }
      });

      return providerDeploymentPresenter(providerDeployment);
    }),

  update: providerDeploymentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerDeploymentId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerDeployment = await providerDeploymentService.updateProviderDeployment({
        providerDeployment: ctx.providerDeployment,
        tenant: ctx.tenant,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerDeploymentPresenter(providerDeployment);
    })
});
