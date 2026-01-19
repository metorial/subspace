import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '@metorial-subspace/db';
import { slatesProvider } from '@metorial-subspace/provider-slates';

let getBackendRecord = createLocallyCachedFunction({
  getHash: (backendOid: bigint) => backendOid.toString(),
  ttlSeconds: 60,
  provider: async backendOid =>
    await db.backend.findFirstOrThrow({
      where: { oid: backendOid }
    })
});

export let getBackend = async ({ entity }: { entity: { backendOid: bigint } }) => {
  let backend = await getBackendRecord(entity.backendOid);

  if (backend.type === 'slates') return slatesProvider.create({ backend });

  throw new Error(`Unsupported backend type: ${backend.type}`);
};
