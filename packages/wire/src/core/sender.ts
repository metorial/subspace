import type { ICoordinationAdapter } from '../adapters/coordination/coordinationAdapter';
import type { ITransportAdapter } from '../adapters/transport/transportAdapter';
import type { SenderConfig } from '../types/config';
import type { TimeoutExtension, WireMessage } from '../types/message';
import { isTimeoutExtension } from '../types/message';
import type { WireResponse } from '../types/response';
import { WireSendError } from '../types/response';
import type {
  TopicListener,
  TopicResponseBroadcast,
  TopicSubscription
} from '../types/topicListener';
import { RetryManager } from './retryManager';

interface InFlightMessage {
  resolve: (response: WireResponse) => void;
  reject: (error: Error) => void;
  timeout: Timer;
  currentTimeout: number;
  messageId: string;
}

export class Sender {
  private senderId: string;
  private retryManager: RetryManager;
  private messageCounter = 0;
  private inFlightMessages: Map<string, InFlightMessage> = new Map();
  private topicSubscriptions: Map<string, string> = new Map(); // topic -> subscriptionId
  private readonly wireId: string;

  constructor(
    private coordination: ICoordinationAdapter,
    private transport: ITransportAdapter,
    private config: SenderConfig,
    wireId: string = 'default'
  ) {
    this.wireId = wireId;
    this.senderId = `sender-${crypto.randomUUID()}`;
    this.retryManager = new RetryManager(
      config.maxRetries,
      config.retryBackoffMs,
      config.retryBackoffMultiplier
    );
  }

  async send(topic: string, payload: unknown, timeout?: number): Promise<WireResponse> {
    let actualTimeout = timeout ?? this.config.defaultTimeout;
    let messageId = this.generateMessageId();

    return this.retryManager.withRetry(async attemptNumber => {
      let message: WireMessage = {
        messageId,
        topic,
        payload,
        replySubject: '', // Will be set by transport
        timeout: actualTimeout,
        sentAt: Date.now(),
        retryCount: attemptNumber
      };

      return await this.sendMessage(message, actualTimeout);
    }, `Send message ${messageId} to topic ${topic}`);
  }

  async subscribeTopic(topic: string, listener: TopicListener): Promise<TopicSubscription> {
    // Check if already subscribed
    if (this.topicSubscriptions.has(topic)) {
      throw new Error(`Already subscribed to topic: ${topic}`);
    }

    // Subscribe to topic response channel
    let subject = `wire.${this.wireId}.topic.responses.${topic}`;

    let subscriptionId = await this.transport.subscribe(subject, async (data: Uint8Array) => {
      try {
        let decoder = new TextDecoder();
        let broadcastStr = decoder.decode(data);
        let broadcast: TopicResponseBroadcast = JSON.parse(broadcastStr);

        // Call listener (don't await to avoid blocking)
        Promise.resolve(listener(broadcast)).catch(err => {
          console.error(`Error in topic listener for ${topic}:`, err);
        });
      } catch (err) {
        console.error(`Error parsing topic broadcast for ${topic}:`, err);
      }
    });

    this.topicSubscriptions.set(topic, subscriptionId);

    return {
      topic,
      unsubscribe: async () => {
        await this.unsubscribeTopic(topic);
      }
    };
  }

  async unsubscribeTopic(topic: string): Promise<void> {
    let subscriptionId = this.topicSubscriptions.get(topic);
    if (!subscriptionId) {
      return;
    }

    await this.transport.unsubscribe(subscriptionId);
    this.topicSubscriptions.delete(topic);
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.topicSubscriptions.keys());
  }

  async close(): Promise<void> {
    // Cancel all in-flight messages
    for (let [messageId, inFlight] of this.inFlightMessages.entries()) {
      clearTimeout(inFlight.timeout);
      inFlight.reject(new Error('Sender closed'));
      this.inFlightMessages.delete(messageId);
    }

    // Unsubscribe from all topics
    let topics = Array.from(this.topicSubscriptions.keys());
    for (let topic of topics) {
      await this.unsubscribeTopic(topic);
    }
  }

  private async sendMessage(message: WireMessage, timeout: number): Promise<WireResponse> {
    // Resolve topic owner
    let receiverId = await this.resolveOwner(message.topic);
    if (!receiverId) {
      throw new WireSendError(
        `No receiver available for topic ${message.topic}`,
        message.messageId,
        message.topic,
        message.retryCount
      );
    }

    // Publish to receiver-specific subject
    let subject = `wire.${this.wireId}.receiver.${receiverId}.${message.topic}`;

    return new Promise<WireResponse>((resolve, reject) => {
      let currentTimeout = timeout;

      // Set up timeout
      let timeoutHandle = setTimeout(() => {
        this.inFlightMessages.delete(message.messageId);
        reject(
          new WireSendError(
            `Request timeout after ${currentTimeout}ms`,
            message.messageId,
            message.topic,
            message.retryCount
          )
        );
      }, currentTimeout);

      // Store in-flight message
      this.inFlightMessages.set(message.messageId, {
        resolve: (response: WireResponse) => {
          clearTimeout(timeoutHandle);
          this.inFlightMessages.delete(message.messageId);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutHandle);
          this.inFlightMessages.delete(message.messageId);
          reject(error);
        },
        timeout: timeoutHandle,
        currentTimeout,
        messageId: message.messageId
      });

      // Encode and send message
      let encoder = new TextEncoder();
      let data = encoder.encode(JSON.stringify(message));

      this.transport
        .request(subject, data, timeout + 1000) // Add buffer to transport timeout
        .then(responseData => {
          let decoder = new TextDecoder();
          let responseStr = decoder.decode(responseData);
          let response = JSON.parse(responseStr) as WireResponse | TimeoutExtension;

          // Check if it's a timeout extension
          if (isTimeoutExtension(response)) {
            this.handleTimeoutExtension(response);
            return; // Don't resolve yet
          }

          // It's a response
          let inFlight = this.inFlightMessages.get(message.messageId);
          if (inFlight) {
            inFlight.resolve(response as WireResponse);
          }
        })
        .catch(err => {
          let inFlight = this.inFlightMessages.get(message.messageId);
          if (inFlight) {
            inFlight.reject(
              new WireSendError(
                `Transport error: ${err.message}`,
                message.messageId,
                message.topic,
                message.retryCount,
                err
              )
            );
          }
        });
    });
  }

  private async resolveOwner(topic: string): Promise<string | null> {
    // Check if topic has an owner
    let owner = await this.coordination.getTopicOwner(topic);
    if (owner) {
      return owner;
    }

    // No owner, need to assign one
    let receivers = await this.coordination.getActiveReceivers();
    if (receivers.length === 0) {
      return null;
    }

    // Pick a random receiver
    let randomReceiver = receivers[Math.floor(Math.random() * receivers.length)];
    if (!randomReceiver) {
      return null;
    }

    // Try to claim ownership
    let claimed = await this.coordination.claimTopicOwnership(
      topic,
      randomReceiver,
      30000 // 30 second TTL
    );

    if (claimed) {
      return randomReceiver;
    }

    // Someone else claimed it, get the winner
    owner = await this.coordination.getTopicOwner(topic);
    return owner;
  }

  private handleTimeoutExtension(extension: TimeoutExtension): void {
    let inFlight = this.inFlightMessages.get(extension.messageId);
    if (!inFlight) {
      return;
    }

    // Clear old timeout
    clearTimeout(inFlight.timeout);

    // Set new timeout with extended time
    let newTimeout = extension.extensionMs;
    inFlight.currentTimeout = newTimeout;
    inFlight.timeout = setTimeout(() => {
      this.inFlightMessages.delete(extension.messageId);
      inFlight.reject(
        new WireSendError(
          `Request timeout after extension (${newTimeout}ms)`,
          extension.messageId,
          '',
          0
        )
      );
    }, newTimeout);
  }

  private generateMessageId(): string {
    return `${this.senderId}:${Date.now()}:${this.messageCounter++}`;
  }

  getSenderId(): string {
    return this.senderId;
  }

  getInFlightCount(): number {
    return this.inFlightMessages.size;
  }
}
