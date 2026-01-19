import { runQueueProcessors } from '@lowerdeck/queue';
import { authQueueProcessor } from '@metorial-subspace/module-auth';
import { catalogQueueProcessor } from '@metorial-subspace/module-catalog';
import { connectionQueueProcessor } from '@metorial-subspace/module-connection';
import { deploymentQueueProcessor } from '@metorial-subspace/module-deployment';
import { providerInternalQueueProcessor } from '@metorial-subspace/module-provider-internal';
import { sessionQueueProcessor } from '@metorial-subspace/module-session';
import { tenantQueueProcessors } from '@metorial-subspace/module-tenant';
import { slatesProviderQueues } from '@metorial-subspace/provider-slates';

runQueueProcessors([
  sessionQueueProcessor,
  connectionQueueProcessor,
  authQueueProcessor,
  catalogQueueProcessor,
  deploymentQueueProcessor,
  tenantQueueProcessors,
  providerInternalQueueProcessor,
  slatesProviderQueues
]);
