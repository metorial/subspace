import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import { WireOutput } from '../types/wireMessage';
import { SenderManager } from './manager';

export class SenderConnection {
  private constructor(private readonly manager: SenderManager) {}

  static async create(d: {
    sessionId: string;
    channelIds?: string[];
  }): Promise<SenderConnection> {
    return new SenderConnection(
      await SenderManager.create({ sessionId: d.sessionId, channelIds: d.channelIds || [] })
    );
  }

  listener() {
    let sub = broadcastNats.subscribe(
      topics.session.encode({ session: this.manager.session })
    );

    let self = this;

    return {
      close: () => sub.unsubscribe(),

      async *[Symbol.asyncIterator]() {
        for await (let msg of sub) {
          let data = JSON.parse(new TextDecoder().decode(msg.data)) as {
            type: string;
            channelIds?: string[];
            output: WireOutput;
          };

          if (
            (data.type === 'message_processed' && self.manager.channelIds.includes('all')) ||
            data.channelIds?.some(cid => self.manager.channelIds.includes(cid))
          ) {
            yield data.output;
          }
        }
      }
    };
  }
}
