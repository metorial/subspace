import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { app } from './_app';
import { tenantApp } from './tenant';

export let callbackAttachmentController = app.controller({
  list: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string()
      })
    )
    .do(async ctx =>
      callbackService.listAttachments({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callbackId: ctx.input.callbackId
      })
    ),

  attach: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        configId: v.string(),
        authConfigId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      callbackService.attachPair({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callbackId: ctx.input.callbackId,
        configId: ctx.input.configId,
        authConfigId: ctx.input.authConfigId
      })
    ),

  detach: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        callbackId: v.string(),
        providerDeploymentConfigPairId: v.string()
      })
    )
    .do(async ctx =>
      callbackService.detachPair({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,
        callbackId: ctx.input.callbackId,
        providerDeploymentConfigPairId: ctx.input.providerDeploymentConfigPairId
      })
    )
});
