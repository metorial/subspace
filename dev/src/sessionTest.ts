import { client, ts } from './client';

let providerDeployment = await client.providerDeployment.create({
  ...ts,
  name: 'Deployment 1',
  providerId: 'pro_0ml3q7ys22iqtZNUezUZ7W',
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
