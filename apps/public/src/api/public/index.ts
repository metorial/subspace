import { createHono } from '@lowerdeck/hono';
import { oauthSetupApp } from './oauthSetup';

export let app = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .route('/oauth-setup', oauthSetupApp);
