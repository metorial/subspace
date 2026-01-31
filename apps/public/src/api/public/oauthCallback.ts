import { createHono } from '@lowerdeck/hono';
import { db } from '@metorial-subspace/db';

export let oauthCallbackApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .get('/:tenantKey/:typeKey', async c => {
    let tenant = await db.tenant.findFirst({
      where: { urlKey: c.req.param('tenantKey') }
    });
    let type = await db.providerType.findFirst({
      where: { shortKey: c.req.param('typeKey') }
    });
    if (!tenant || !type) {
      return c.text('Invalid oauth callback URL', 400);
    }

    if (
      type.attributes.auth.status == 'disabled' ||
      type.attributes.auth.oauth.status == 'disabled'
    ) {
      return c.text('OAuth is disabled for this provider', 400);
    }

    return c.redirect(type.attributes.auth.oauth.oauthCallbackUrl);
  });
