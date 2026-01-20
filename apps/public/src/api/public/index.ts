import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import path from 'path';
import { oauthSetupApp } from './oauthSetup';
import { setupSessionApp } from './setupSession';

let assetsDir = path.join(process.cwd(), 'frontend', 'dist', 'assets');

export let app = createHono()
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .get('/subspace-public/assets/:key*', async c => {
    let key = c.req.param('key*');

    let targetPath = path.resolve(assetsDir, key);
    if (!targetPath.startsWith(assetsDir)) return c.text('Forbidden', 403);

    let bunFile = Bun.file(targetPath);
    if (!(await bunFile.exists())) return c.text('Not Found', 404);

    return c.body(await bunFile.arrayBuffer(), {
      headers: {
        'Content-Type': bunFile.type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  })
  .route('/oauth-setup', oauthSetupApp)
  .route('/setup-session', setupSessionApp)
  .get('/:key*', async c => {
    let key = c.req.param('key*');

    let targetPath = path.resolve(assetsDir, key);
    if (!targetPath.startsWith(assetsDir)) return c.text('Forbidden', 403);

    let bunFile = Bun.file(targetPath);
    if (!(await bunFile.exists())) throw new ServiceError(notFoundError('endpoint'));

    return c.body(await bunFile.arrayBuffer(), {
      headers: {
        'Content-Type': bunFile.type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  });
