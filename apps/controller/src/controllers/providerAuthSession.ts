import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthSessionPresenter } from '@metorial-subspace/db';
import {
  providerAuthCredentialsService,
  providerAuthSessionService
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerAuthSessionApp = tenantApp.use(async ctx => {
  let providerAuthSessionId = ctx.body.providerAuthSessionId;
  if (!providerAuthSessionId) throw new Error('ProviderAuthSession ID is required');

  let providerAuthSession = await providerAuthSessionService.getProviderAuthSessionById({
    providerAuthSessionId,
    tenant: ctx.tenant,
    solution: ctx.solution
  });

  return { providerAuthSession };
});

export let providerAuthSessionController = app.controller({
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
      let paginator = await providerAuthSessionService.listProviderAuthSessions({
        tenant: ctx.tenant,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerAuthSessionPresenter);
    }),

  get: providerAuthSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthSessionId: v.string()
      })
    )
    .do(async ctx => providerAuthSessionPresenter(ctx.providerAuthSession)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        ip: v.string(),
        ua: v.string(),

        providerId: v.string(),
        providerAuthCredentialsId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),

        providerAuthMethodId: v.optional(v.string()),
        redirectUrl: v.optional(v.string()),
        config: v.optional(v.record(v.any()))
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
            tenant: ctx.tenant,
            solution: ctx.solution,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;

      let credentials = ctx.input.providerAuthCredentialsId
        ? await providerAuthCredentialsService.getProviderAuthCredentialsById({
            providerAuthCredentialsId: ctx.input.providerAuthCredentialsId,
            tenant: ctx.tenant,
            solution: ctx.solution
          })
        : undefined;

      let providerAuthSession = await providerAuthSessionService.createProviderAuthSession({
        tenant: ctx.tenant,
        solution: ctx.solution,

        provider,
        providerDeployment,
        credentials,

        import: {
          ip: ctx.input.ip,
          ua: ctx.input.ua
        },

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          config: ctx.input.config,

          redirectUrl: ctx.input.redirectUrl
        }
      });

      return providerAuthSessionPresenter(providerAuthSession);
    }),

  update: providerAuthSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        providerAuthSessionId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerAuthSession = await providerAuthSessionService.updateProviderAuthSession({
        providerAuthSession: ctx.providerAuthSession,
        tenant: ctx.tenant,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerAuthSessionPresenter(providerAuthSession);
    })
});
