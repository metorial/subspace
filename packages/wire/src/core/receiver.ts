import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { MemoryTransport } from '../adapters/transport/memoryTransport';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { ReceiverConfig } from '../types/config';
import type { TimeoutExtension, WireMessage } from '../types/message';
import type { WireResponse } from '../types/response';
import type { TopicResponseBroadcast } from '../types/topicListener';
import { MessageCache } from './messageCache';
import { OwnershipManager } from './ownershipManager';

export type MessageHandler = (topic: string, payload: unknown) => Promise<unknown>;

export class Receiver {
  private receiverId: string;
  private messageCache: MessageCache;
  private ownershipManager: OwnershipManager;
  private heartbeatInterval: Timer | null = null;
  private subscriptionId: string | null = null;
  private running = false;
  private readonly wireId: string;

  constructor(
    private coordination: ICoordinationAdapter,
    private transport: ITransportAdapter,
    private config: ReceiverConfig,
    private handler: MessageHandler,
    wireId: string = 'default'
  ) {
    this.wireId = wireId;
    this.receiverId = `receiver-${crypto.randomUUID()}`;
    this.messageCache = new MessageCache(config.messageCacheSize, config.messageCacheTtl);
    this.ownershipManager = new OwnershipManager(
      this.receiverId,
      coordination,
      config.ownershipRenewalInterval,
      config.topicOwnershipTtl
    );
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Register receiver
    await this.coordination.registerReceiver(this.receiverId, this.config.heartbeatTtl);

    // Start heartbeat
    this.startHeartbeat();

    // Start ownership renewal
    this.ownershipManager.start();

    // Subscribe to messages
    await this.subscribe();
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop heartbeat
    this.stopHeartbeat();

    // Stop ownership renewal
    this.ownershipManager.stop();

    // Release all owned topics
    await this.ownershipManager.releaseAll();

    // Unsubscribe
    if (this.subscriptionId) {
      await this.transport.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    // Unregister receiver
    await this.coordination.unregisterReceiver(this.receiverId);

    // Cleanup cache
    this.messageCache.destroy();
  }

  private async subscribe(): Promise<void> {
    // Subscribe to wire.{wireId}.receiver.{receiverId}.>
    let subject = `wire.${this.wireId}.receiver.${this.receiverId}.>`;

    this.subscriptionId = await this.transport.subscribe(subject, async (data: Uint8Array) => {
      await this.handleMessage(data);
    });
  }

  private async handleMessage(data: Uint8Array): Promise<void> {
    try {
      // Decode message
      let decoder = new TextDecoder();
      let messageStr = decoder.decode(data);
      let message: WireMessage = JSON.parse(messageStr);

      // Check if we've seen this message before
      let cachedResponse = this.messageCache.get(message.messageId);
      if (cachedResponse) {
        // Return cached response
        await this.sendResponse(message, cachedResponse);
        return;
      }

      // Add topic to ownership (we're processing it now)
      this.ownershipManager.addTopic(message.topic);

      // Process message
      let response = await this.processMessage(message);

      // Cache the response
      this.messageCache.set(message.messageId, response);

      // Send response
      await this.sendResponse(message, response);
    } catch (err) {
      console.error('Error handling message:', err);
      // If we can't even parse/decode, we can't respond
    }
  }

  private async processMessage(message: WireMessage): Promise<WireResponse> {
    try {
      // Monitor timeout and send extensions if needed
      let timeoutMonitor = this.startTimeoutMonitor(message);

      // Call user handler
      let result = await this.handler(message.topic, message.payload);

      // Stop timeout monitor
      clearInterval(timeoutMonitor);

      // Create success response
      return {
        messageId: message.messageId,
        success: true,
        result,
        processedAt: Date.now()
      };
    } catch (err) {
      let error = err instanceof Error ? err : new Error(String(err));

      console.error(
        `Error processing message ${message.messageId} on topic ${message.topic}:`,
        error
      );

      // Create error response
      return {
        messageId: message.messageId,
        success: false,
        error: error.message,
        processedAt: Date.now()
      };
    }
  }

  private startTimeoutMonitor(message: WireMessage): Timer {
    let startTime = Date.now();
    let threshold = this.config.timeoutExtensionThreshold;

    return setInterval(() => {
      let elapsed = Date.now() - startTime;
      let remaining = message.timeout - elapsed;

      // If we're getting close to timeout, send extension
      if (remaining < threshold && remaining > 0) {
        let extension: TimeoutExtension = {
          messageId: message.messageId,
          extensionMs: 10000, // Request 10 more seconds
          type: 'timeout_extension'
        };

        this.sendExtension(message, extension).catch(err => {
          console.error('Error sending timeout extension:', err);
        });
      }
    }, 500); // Check every 500ms
  }

  private async sendExtension(
    message: WireMessage,
    extension: TimeoutExtension
  ): Promise<void> {
    let encoder = new TextEncoder();
    let data = encoder.encode(JSON.stringify(extension));

    // For MemoryTransport, we need special handling
    if (this.isMemoryTransport()) {
      await (this.transport as MemoryTransport).reply(message.replySubject, data);
    } else {
      // For NATS, publish to reply subject
      await this.transport.publish(message.replySubject, data);
    }
  }

  private async sendResponse(message: WireMessage, response: WireResponse): Promise<void> {
    let encoder = new TextEncoder();
    let data = encoder.encode(JSON.stringify(response));

    // Send direct reply to sender
    if (this.isMemoryTransport()) {
      await (this.transport as MemoryTransport).reply(message.replySubject, data);
    } else {
      // For NATS, publish to reply subject
      await this.transport.publish(message.replySubject, data);
    }

    // Broadcast response to topic listeners
    await this.broadcastTopicResponse(message, response);
  }

  private async broadcastTopicResponse(
    message: WireMessage,
    response: WireResponse
  ): Promise<void> {
    try {
      let broadcast: TopicResponseBroadcast = {
        topic: message.topic,
        messageId: message.messageId,
        response,
        receiverId: this.receiverId,
        broadcastAt: Date.now()
      };

      let encoder = new TextEncoder();
      let data = encoder.encode(JSON.stringify(broadcast));
      let subject = `wire.${this.wireId}.topic.responses.${message.topic}`;

      await this.transport.publish(subject, data);
    } catch (err) {
      // Don't fail the response if broadcast fails
      console.error(`Error broadcasting topic response for ${message.topic}:`, err);
    }
  }

  private isMemoryTransport(): boolean {
    return 'reply' in this.transport;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      this.coordination
        .registerReceiver(this.receiverId, this.config.heartbeatTtl)
        .catch(err => {
          console.error('Error sending heartbeat:', err);
        });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getReceiverId(): string {
    return this.receiverId;
  }

  getOwnedTopicCount(): number {
    return this.ownershipManager.getOwnedCount();
  }

  getOwnedTopics(): string[] {
    return this.ownershipManager.getOwnedTopics();
  }

  isRunning(): boolean {
    return this.running;
  }
}
