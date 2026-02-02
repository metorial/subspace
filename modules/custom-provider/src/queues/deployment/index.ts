import { combineQueueProcessors } from '@lowerdeck/queue';
import { customDeploymentFailedQueueProcessor } from './failed';
import { customDeploymentMonitorQueueProcessor } from './monitor';
import { customDeploymentSucceededQueueProcessor } from './succeeded';

export let deploymentQueues = combineQueueProcessors([
  customDeploymentMonitorQueueProcessor,
  customDeploymentSucceededQueueProcessor,
  customDeploymentFailedQueueProcessor
]);
