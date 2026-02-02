import { delay } from '@lowerdeck/delay';
import { actor, client, ts } from './client';

let remoteDeployment = await client.customProvider.create({
  ...ts,
  actorId: actor.id,

  name: 'Custom 1',

  from: {
    type: 'remote',
    remoteUrl: 'https://docs.mcp.cloudflare.com/sse',
    protocol: 'sse'

    // remoteUrl: 'https://logs.mcp.cloudflare.com/mcp',
    // protocol: 'streamable_http'
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
    type: 'inline',
    data: {}
  }
});

console.log('Created provider deployment:', providerDeployment);

let session = await client.session.create({
  ...ts,
  name: 'Session 1',
  providers: [
    {
      providerDeploymentId: providerDeployment.id
    }
  ]
});
console.log('Created session:', session);
