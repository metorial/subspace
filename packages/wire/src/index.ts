// Core components
export { MessageCache } from './core/messageCache';
export { OwnershipManager } from './core/ownershipManager';
export { Receiver } from './core/receiver';
export type { MessageHandler } from './core/receiver';
export { RetryManager } from './core/retryManager';
export { Sender } from './core/sender';

// Adapters - Interfaces
export type { ICoordinationAdapter } from './adapters/coordination/coordinationAdapter';
export type {
  ITransportAdapter,
  MessageHandler as TransportMessageHandler
} from './adapters/transport/transportAdapter';

// Adapters - Implementations
export { MemoryCoordination } from './adapters/coordination/memoryCoordination';
export { RedisCoordination } from './adapters/coordination/redisCoordination';
export { MemoryTransport } from './adapters/transport/memoryTransport';
export { NatsTransport } from './adapters/transport/natsTransport';

// Imports for factory function
import { MemoryCoordination } from './adapters/coordination/memoryCoordination';
import { MemoryTransport } from './adapters/transport/memoryTransport';
import { Receiver, type MessageHandler } from './core/receiver';
import { Sender } from './core/sender';
import type { ReceiverConfig, SenderConfig } from './types/config';

// Types
export { DEFAULT_CONFIG, mergeConfig } from './types/config';
export type {
  CoordinationConfig,
  NatsConfig,
  ReceiverConfig,
  RedisConfig,
  SenderConfig,
  TransportConfig,
  WireConfig
} from './types/config';
export { isTimeoutExtension } from './types/message';
export type { TimeoutExtension, WireMessage } from './types/message';
export { WireProcessError, WireSendError } from './types/response';
export type { WireResponse } from './types/response';
export type {
  TopicListener,
  TopicResponseBroadcast,
  TopicSubscription
} from './types/topicListener';

// Factory functions for easy setup
export function createMemoryWire(wireId: string = 'default') {
  const coordination = new MemoryCoordination(wireId);
  const transport = new MemoryTransport();

  return {
    coordination,
    transport,
    createSender: (config?: Partial<SenderConfig>) => {
      const fullConfig = {
        defaultTimeout: 5000,
        maxRetries: 3,
        retryBackoffMs: 100,
        retryBackoffMultiplier: 2,
        inFlightCacheTtl: 60000,
        ...config
      };
      return new Sender(coordination, transport, fullConfig, wireId);
    },
    createReceiver: (handler: MessageHandler, config?: Partial<ReceiverConfig>) => {
      const fullConfig = {
        heartbeatInterval: 5000,
        heartbeatTtl: 10000,
        topicOwnershipTtl: 30000,
        ownershipRenewalInterval: 20000,
        messageCacheTtl: 60000,
        messageCacheSize: 10000,
        timeoutExtensionThreshold: 1000,
        ...config
      };
      return new Receiver(coordination, transport, fullConfig, handler, wireId);
    },
    close: async () => {
      await coordination.close();
      await transport.close();
    }
  };
}
