export interface WireConfig {
  wireId: string;

  receiver: ReceiverConfig;

  sender: SenderConfig;

  coordination: CoordinationConfig;

  transport: TransportConfig;
}

export interface ReceiverConfig {
  heartbeatInterval: number;

  heartbeatTtl: number;

  topicOwnershipTtl: number;

  ownershipRenewalInterval: number;

  messageCacheTtl: number;

  messageCacheSize: number;

  timeoutExtensionThreshold: number;
}

export interface SenderConfig {
  defaultTimeout: number;

  maxRetries: number;

  retryBackoffMs: number;

  retryBackoffMultiplier: number;

  inFlightCacheTtl: number;
}

export type CoordinationConfig = { type: 'redis'; redis: RedisConfig } | { type: 'memory' };

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export type TransportConfig = { type: 'nats'; nats: NatsConfig } | { type: 'memory' };

export interface NatsConfig {
  servers: string[];
  token?: string;
  user?: string;
  pass?: string;
}

export const DEFAULT_CONFIG: WireConfig = {
  wireId: 'default',
  receiver: {
    heartbeatInterval: 5000,
    heartbeatTtl: 10000,
    topicOwnershipTtl: 30000,
    ownershipRenewalInterval: 20000,
    messageCacheTtl: 60000,
    messageCacheSize: 10000,
    timeoutExtensionThreshold: 1000
  },
  sender: {
    defaultTimeout: 5000,
    maxRetries: 3,
    retryBackoffMs: 100,
    retryBackoffMultiplier: 2,
    inFlightCacheTtl: 60000
  },
  coordination: {
    type: 'memory'
  },
  transport: {
    type: 'memory'
  }
};

export let mergeConfig = (userConfig: Partial<WireConfig>): WireConfig => {
  return {
    wireId: userConfig.wireId || DEFAULT_CONFIG.wireId,
    receiver: { ...DEFAULT_CONFIG.receiver, ...userConfig.receiver },
    sender: { ...DEFAULT_CONFIG.sender, ...userConfig.sender },
    coordination: userConfig.coordination || DEFAULT_CONFIG.coordination,
    transport: userConfig.transport || DEFAULT_CONFIG.transport
  };
};
