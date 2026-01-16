import { badRequestError, ServiceError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { SessionProvider } from '@metorial-subspace/db';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import { BroadcastMessage } from '../types/wireMessage';
import {
  CallToolProps,
  CreateMessageProps,
  InitProps,
  SenderManager,
  SenderMangerProps
} from './manager';

export class SenderConnection {
  private constructor(private readonly manager: SenderManager) {}

  static async create(d: SenderMangerProps): Promise<SenderConnection> {
    return new SenderConnection(await SenderManager.create(d));
  }

  get connection() {
    return this.manager.connection;
  }

  get session() {
    return this.manager.session;
  }

  listener() {
    if (!this.manager.connection) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create listener without an active connection'
        })
      );
    }

    let sub = broadcastNats.subscribe(
      topics.sessionConnection.encode({
        session: this.manager.session,
        connection: this.manager.connection
      })
    );

    return {
      close: () => sub.unsubscribe(),

      async *[Symbol.asyncIterator]() {
        for await (let msg of sub) {
          let data = serialize.decode(new TextDecoder().decode(msg.data)) as BroadcastMessage;

          yield {
            ...data.result,
            channel: data.channel
          };
        }
      }
    };
  }

  ensureProviderInstance(provider: SessionProvider) {
    return this.manager.ensureProviderInstance(provider);
  }

  listToolsForProvider(provider: SessionProvider) {
    return this.manager.listToolsForProvider(provider);
  }

  listTools() {
    return this.manager.listTools();
  }

  listProviders() {
    return this.manager.listProviders();
  }

  getToolById(d: { toolId: string }) {
    return this.manager.getToolById(d);
  }

  callTool(d: CallToolProps) {
    return this.manager.callTool(d);
  }

  initialize(d: InitProps) {
    return this.manager.initialize(d);
  }

  createConnection() {
    return this.manager.createConnection();
  }

  createMessage(d: CreateMessageProps) {
    return this.manager.createMessage(d);
  }
}
