import { v } from '@lowerdeck/validation';
import { brandPresenter, providerSetupSessionPresenter } from '@metorial-subspace/db';
import { providerSetupSessionInternalService } from '@metorial-subspace/module-auth';
import { brandService } from '@metorial-subspace/module-tenant';
import { app } from './_app';

export let getFullSession = async (input: { sessionId: string; clientSecret: string }) => {
  let session =
    await providerSetupSessionInternalService.getProviderSetupSessionByClientSecret({
      sessionId: input.sessionId,
      clientSecret: input.clientSecret
    });

  let brand =
    session.brand ?? (await brandService.getBrandForTenant({ tenantId: session.tenant.id }));

  return {
    session: providerSetupSessionPresenter(session),
    brand: brandPresenter(brand)
  };
};

export let setupSessionController = app.controller({
  get: app
    .handler()
    .input(
      v.object({
        sessionId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => await getFullSession(ctx.input))
});
