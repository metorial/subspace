import { SessionConnectionMcpConnectionTransport } from '@metorial-subspace/db';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { interleave } from '../lib/interleave';
import { SenderMangerProps } from '../sender';
import { McpControlMessageHandler } from './control';
import { McpManager } from './manager';
import { HandleResponseOpts, McpSender } from './sender';

export class McpConnection {
  #control: McpControlMessageHandler;
  #sender: McpSender;

  private constructor(
    private readonly manager: McpManager,
    mcpTransport: SessionConnectionMcpConnectionTransport
  ) {
    this.#control = new McpControlMessageHandler(this.manager);
    this.#sender = new McpSender(mcpTransport, this.manager, this.#control);
  }

  static async create(
    d: SenderMangerProps & {
      mcpTransport: SessionConnectionMcpConnectionTransport;
    }
  ): Promise<McpConnection> {
    return new McpConnection(await McpManager.create(d), d.mcpTransport);
  }

  get session() {
    return this.manager.session;
  }

  get connection() {
    return this.manager.connection;
  }

  async listener(d: { selectedChannels: 'all' | 'broadcast' }) {
    let controlListener = await this.#control.controlListener(d);
    let senderListener = this.manager.senderListener(d);

    return {
      close: () => Promise.allSettled([senderListener.close(), controlListener.close()]),
      iterator: () => interleave(senderListener, controlListener)
    };
  }

  async handleMessage(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    return this.#sender.handleMessage(msg, opts);
  }

  async createConnection() {
    return this.manager.createConnection();
  }
}
