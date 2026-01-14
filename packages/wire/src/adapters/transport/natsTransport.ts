import { connect, type NatsConnection, type Subscription } from 'nats';
import type { NatsConfig } from '../../types/config';
import type { ITransportAdapter, MessageHandler } from './transportAdapter';

export class NatsTransport implements ITransportAdapter {
  private nc: NatsConnection | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private nextSubId = 0;

  constructor(private config: NatsConfig) {}

  async connect(): Promise<void> {
    if (this.nc) {
      return;
    }

    this.nc = await connect({
      servers: this.config.servers,
      token: this.config.token,
      user: this.config.user,
      pass: this.config.pass
    });
  }

  async publish(subject: string, data: Uint8Array): Promise<void> {
    if (!this.nc) {
      throw new Error('NATS not connected. Call connect() first.');
    }

    this.nc.publish(subject, data);
  }

  async request(subject: string, data: Uint8Array, timeout: number): Promise<Uint8Array> {
    if (!this.nc) {
      throw new Error('NATS not connected. Call connect() first.');
    }

    let response = await this.nc.request(subject, data, { timeout });
    return response.data;
  }

  async subscribe(subject: string, handler: MessageHandler): Promise<string> {
    if (!this.nc) {
      throw new Error('NATS not connected. Call connect() first.');
    }

    let id = `sub-${this.nextSubId++}`;
    let sub = this.nc.subscribe(subject);

    // Store subscription
    this.subscriptions.set(id, sub);

    // Process messages in background
    (async () => {
      try {
        for await (let msg of sub) {
          try {
            await handler(msg.data);

            // If message has a reply subject, it's a request that expects a response
            // The handler should have already published a response
          } catch (err) {
            console.error(`Error handling message on ${subject}:`, err);
          }
        }
      } catch (err) {
        console.error(`Subscription error on ${subject}:`, err);
      }
    })();

    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    let sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  async close(): Promise<void> {
    if (!this.nc) {
      return;
    }

    // Unsubscribe all
    for (let sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();

    // Close connection
    await this.nc.close();
    this.nc = null;
  }

  /**
   * Get the underlying NATS connection
   * Useful for advanced use cases like replying to requests
   */
  getConnection(): NatsConnection | null {
    return this.nc;
  }
}
