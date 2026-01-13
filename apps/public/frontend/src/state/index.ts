// import { createLoader } from '@metorial-io/data-hooks';
// import { client } from './client';

// export let authSessionState = createLoader({
//   name: 'authSession',
//   fetch: (d: { id: string }) => {
//     client.admin.getUser({
//       id: d.id
//     });
//   },
//   mutators: {
//     impersonate: (d: { reason: string }, { output }) => {
//       client.admin.impersonateUser({
//         id: output.id,
//         reason: d.reason
//       });
//     }
//   }
// });
