import { runQueueProcessors } from '@lowerdeck/queue';
import { authQueueProcessor } from '@metorial-subspace/module-auth';
import { callbackQueueProcessor } from '@metorial-subspace/module-callback';
import { catalogQueueProcessor } from '@metorial-subspace/module-catalog';
import { connectionQueueProcessor } from '@metorial-subspace/module-connection';
import { customProviderQueueProcessor } from '@metorial-subspace/module-custom-provider';
import { deploymentQueueProcessor } from '@metorial-subspace/module-deployment';
import { providerInternalQueueProcessor } from '@metorial-subspace/module-provider-internal';
import { sessionQueueProcessor } from '@metorial-subspace/module-session';
import { tenantQueueProcessors } from '@metorial-subspace/module-tenant';
import { nativeProviderQueues } from '@metorial-subspace/provider-native';
import { shuttleProviderQueues } from '@metorial-subspace/provider-shuttle';
import { slatesProviderQueues } from '@metorial-subspace/provider-slates';

runQueueProcessors([
  sessionQueueProcessor,
  connectionQueueProcessor,
  authQueueProcessor,
  catalogQueueProcessor,
  deploymentQueueProcessor,
  tenantQueueProcessors,
  providerInternalQueueProcessor,
  nativeProviderQueues,
  slatesProviderQueues,
  shuttleProviderQueues,
  customProviderQueueProcessor,
  callbackQueueProcessor
]);
