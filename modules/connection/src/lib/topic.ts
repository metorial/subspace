import { SessionProviderInstance } from '@metorial-subspace/db';

let PREFIX = 'v1-spi-';

export let topics = {
  encode: (d: { instance: SessionProviderInstance }) => PREFIX + d.instance.oid,
  decode: (topic: string) => {
    if (!topic.startsWith(PREFIX)) return null;

    let oid = topic.slice(PREFIX.length);
    return { instanceOid: BigInt(oid) };
  }
};
