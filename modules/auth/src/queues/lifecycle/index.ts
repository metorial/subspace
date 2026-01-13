import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerAuthConfigCreatedQueueProcessor,
  providerAuthConfigUpdatedQueueProcessor
} from './providerAuthConfig';
import {
  providerAuthCredentialsCreatedQueueProcessor,
  providerAuthCredentialsUpdatedQueueProcessor
} from './providerAuthCredentials';
import {
  providerAuthSessionCreatedQueueProcessor,
  providerAuthSessionUpdatedQueueProcessor
} from './providerAuthSession';
import {
  providerOAuthSetupCreatedQueueProcessor,
  providerOAuthSetupUpdatedQueueProcessor
} from './providerOAuthSetup';

export let lifecycleQueues = combineQueueProcessors([
  providerAuthCredentialsCreatedQueueProcessor,
  providerAuthCredentialsUpdatedQueueProcessor,
  providerAuthConfigCreatedQueueProcessor,
  providerAuthConfigUpdatedQueueProcessor,
  providerOAuthSetupCreatedQueueProcessor,
  providerOAuthSetupUpdatedQueueProcessor,
  providerAuthSessionCreatedQueueProcessor,
  providerAuthSessionUpdatedQueueProcessor
]);
