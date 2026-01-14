import type { WireResponse } from './response';

export interface TopicResponseBroadcast {
  topic: string;

  messageId: string;

  response: WireResponse;

  receiverId: string;

  broadcastAt: number;
}

export type TopicListener = (broadcast: TopicResponseBroadcast) => void | Promise<void>;

export interface TopicSubscription {
  topic: string;

  unsubscribe(): Promise<void>;
}
