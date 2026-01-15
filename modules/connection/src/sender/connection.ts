import { SenderManager } from './manager';

export class SenderConnection {
  private constructor(private readonly manager: SenderManager) {}

  static async create(d: {
    sessionId: string;
    channelIds?: string[];
  }): Promise<SenderConnection> {
    return new SenderConnection(await SenderManager.create({ sessionId: d.sessionId }));
  }
}
