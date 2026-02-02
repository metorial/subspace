import { delay } from '@lowerdeck/delay';
import { actor, client, ts } from './client';

let remoteDeployment = await client.customProvider.create({
  ...ts,
  actorId: actor.id,

  name: 'Custom 2',

  from: {
    type: 'remote',
    remoteUrl: 'https://mcp.linear.app/mcp',
    protocol: 'streamable_http'
  }
});

console.log(remoteDeployment);

let deployments = await client.customProviderDeployment.list({
  ...ts,

  customProviderIds: [remoteDeployment.id]
});

let deployment = deployments.items[0]!;

while (true) {
  deployment = await client.customProviderDeployment.get({
    ...ts,
    customProviderDeploymentId: deployment.id
  });

  console.log('Deployment status:', deployment.status, deployment.providerId);

  if (deployment.status === 'failed' || deployment.status === 'succeeded') break;

  await delay(500);
}

console.log('Final deployment:', deployment);

let providerDeployment = await client.providerDeployment.create({
  ...ts,
  name: 'Deployment 1',
  providerId: deployment.providerId!,
  config: {
    type: 'none'
  }
});

console.log('Created provider deployment:', providerDeployment);

let authSetup = await client.providerSetupSession.create({
  ...ts,
  uiMode: 'metorial_elements',

  type: 'auth_and_config',
  ip: '0.0.0.0',
  ua: 'unknown',
  providerId: providerDeployment.providerId,

  redirectUrl: 'https://example.com'
});

console.log('Created auth setup session:', authSetup);

while (authSetup.status !== 'completed') {
  authSetup = await client.providerSetupSession.get({
    ...ts,
    providerSetupSessionId: authSetup.id
  });

  console.log('Auth setup status:', authSetup.status, authSetup.authConfig);

  if (authSetup.status === 'completed') break;

  if (authSetup.status === 'failed') {
    throw new Error('Auth setup failed');
  }

  await delay(500);
}

let session = await client.session.create({
  ...ts,
  name: 'Session 1',
  providers: [
    {
      providerDeploymentId: providerDeployment.id,
      providerAuthConfigId: authSetup.authConfig?.id
    }
  ]
});
console.log('Created session:', session);
