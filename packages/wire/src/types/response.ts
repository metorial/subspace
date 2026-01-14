export interface WireResponse {
  messageId: string;

  success: boolean;

  result?: unknown;

  error?: string;

  processedAt: number;
}

export class WireSendError extends Error {
  public readonly messageId: string;
  public readonly topic: string;
  public readonly retryCount: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    messageId: string,
    topic: string,
    retryCount: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'WireSendError';
    this.messageId = messageId;
    this.topic = topic;
    this.retryCount = retryCount;
    this.originalError = cause;
  }
}

export class WireProcessError extends Error {
  public readonly messageId: string;
  public readonly topic: string;
  public readonly originalError?: Error;

  constructor(message: string, messageId: string, topic: string, cause?: Error) {
    super(message);
    this.name = 'WireProcessError';
    this.messageId = messageId;
    this.topic = topic;
    this.originalError = cause;
  }
}
