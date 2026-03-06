import './integrations';

import { combineQueueProcessors } from '@lowerdeck/queue';
import { nativeProviderBootstrapPromise } from './sync';

await nativeProviderBootstrapPromise;

export let nativeProviderQueues = combineQueueProcessors([]);

export * from './impl';
export * from './registry';
export * from './sync';
