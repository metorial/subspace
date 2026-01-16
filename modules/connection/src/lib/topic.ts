import { Session, SessionProviderInstance } from '@metorial-subspace/db';

let INSTANCE_PREFIX = 'v1-spi-';
let SESSION_PREFIX = 'v1-ses-';

export let topics = {
  instance: {
    encode: (d: { instance: SessionProviderInstance }) => INSTANCE_PREFIX + d.instance.oid,
    decode: (topic: string) => {
      if (!topic.startsWith(INSTANCE_PREFIX)) return null;

      let oid = topic.slice(INSTANCE_PREFIX.length);
      return { instanceOid: BigInt(oid) };
    }
  },

  session: {
    encode: (d: { session: Session }) => SESSION_PREFIX + d.session.id
  }
};
