import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  expireIdentityDelegationsCron,
  expireIdentityDelegationsManyQueueProcessor
} from './delegation';

export let expireQueues = combineQueueProcessors([
  expireIdentityDelegationsCron,
  expireIdentityDelegationsManyQueueProcessor
]);
