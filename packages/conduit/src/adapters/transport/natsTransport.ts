import { getSentry } from '@lowerdeck/sentry';
import { connect, type NatsConnection, type Subscription } from 'nats';
import type { NatsConfig } from '../../types/config';
import type { ITransportAdapter, MessageHandler } from './transportAdapter';

let Sentry = getSentry();

export class NatsTransport implements ITransportAdapter {
  private nc: Promise<NatsConnection>;
  private subscriptions: Map<string, Subscription> = new Map();
  private nextSubId = 0;

  constructor(private config: NatsConfig) {
    this.nc = connect({
      servers: this.config.servers,
      token: this.config.token,
      user: this.config.user,
      pass: this.config.pass,

      waitOnFirstConnect: true
    });
  }

  async publish(subject: string, data: Uint8Array): Promise<void> {
    let nc = await this.nc;
    nc.publish(subject, data);
  }

  async request(subject: string, data: Uint8Array, timeout: number): Promise<Uint8Array> {
    let nc = await this.nc;

    let response = await nc.request(subject, data, { timeout });
    return response.data;
  }

  async subscribe(subject: string, handler: MessageHandler): Promise<string> {
    let nc = await this.nc;

    let id = `sub-${this.nextSubId++}`;
    let sub = nc.subscribe(subject);

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
        Sentry.captureException(err);
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
    let nc = await this.nc;

    // Unsubscribe all
    for (let sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();

    // Close connection
    await nc.close();
    this.nc = null as any;
  }
}
