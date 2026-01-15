// Core components
export { MessageCache } from './core/messageCache';
export { OwnershipManager } from './core/ownershipManager';
export type { OwnershipLossCallback } from './core/ownershipManager';
export { Receiver } from './core/receiver';
export type { MessageHandler } from './core/receiver';
export { RetryManager } from './core/retryManager';
export { Sender } from './core/sender';
export { createWireReceiver, WireReceiver } from './core/wireReceiver';
export type { TopicContext, TopicHandler, WireReceiverConfig } from './core/wireReceiver';

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
import { RedisCoordination } from './adapters/coordination/redisCoordination';
import { MemoryTransport } from './adapters/transport/memoryTransport';
import { NatsTransport } from './adapters/transport/natsTransport';
import { Receiver, type MessageHandler } from './core/receiver';
import { Sender } from './core/sender';
import { createWireReceiver, type TopicHandler } from './core/wireReceiver';
import type { NatsConfig, ReceiverConfig, RedisConfig, SenderConfig } from './types/config';

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

let getSenderConfig = (config?: Partial<SenderConfig>): SenderConfig => ({
  defaultTimeout: 5000,
  maxRetries: 10,
  retryBackoffMs: 100,
  retryBackoffMultiplier: 2,
  inFlightCacheTtl: 60000,
  maxInFlightMessages: 1000,
  ...config
});

let getReceiverConfig = (config?: Partial<ReceiverConfig>): ReceiverConfig => ({
  heartbeatInterval: 3000,
  heartbeatTtl: 10000,
  topicOwnershipTtl: 15000,
  ownershipRenewalInterval: 5000,
  messageCacheTtl: 60000,
  messageCacheSize: 10000,
  timeoutExtensionThreshold: 1000,
  ...config
});

export let createMemoryWire = (wireId: string = 'default') => {
  let coordination = new MemoryCoordination(wireId);
  let transport = new MemoryTransport();

  return {
    wireId,
    coordination,
    transport
  };
};

export let createRedisNatsWire = (opts: {
  wireId: string;
  redisConfig: RedisConfig;
  natsConfig: NatsConfig;
}) => {
  let coordination = new RedisCoordination(opts.redisConfig, opts.wireId);
  let transport = new NatsTransport(opts.natsConfig);

  return {
    wireId: opts.wireId,
    coordination,
    transport
  };
};

export type Adapter =
  | ReturnType<typeof createMemoryWire>
  | ReturnType<typeof createRedisNatsWire>;

export let createWire = (adapter: Adapter = createMemoryWire()) => {
  let { wireId, coordination, transport } = adapter;

  return {
    coordination,
    transport,
    createSender: (config?: Partial<SenderConfig>) =>
      new Sender(coordination, transport, getSenderConfig(config), wireId),
    createReceiver: (handler: MessageHandler, config?: Partial<ReceiverConfig>) =>
      new Receiver(coordination, transport, getReceiverConfig(config), handler, wireId),
    createWireReceiver: (handleTopic: TopicHandler, config?: Partial<ReceiverConfig>) =>
      createWireReceiver({
        coordination,
        transport,
        wireId,
        handleTopic,
        config: getReceiverConfig(config)
      }),
    close: async () => {
      await coordination.close();
      await transport.close();
    }
  };
};
