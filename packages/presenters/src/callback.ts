import type {
  Callback,
  CallbackDestination,
  CallbackDestinationLink,
  CallbackManualPairLink,
  CallbackTrigger,
  ProviderDeployment
} from '@metorial-subspace/db';
import { callbackDestinationPresenter } from './callbackDestination';
import { providerDeploymentPresenter } from './deployment';

export let callbackPresenter = (
  callback: Callback & {
    providerDeployment: ProviderDeployment;
    callbackTriggers: CallbackTrigger[];
    callbackDestinationLinks: (CallbackDestinationLink & {
      callbackDestination: CallbackDestination;
    })[];
    callbackManualPairLinks: CallbackManualPairLink[];
  }
) => ({
  object: 'callback',
  id: callback.id,
  status: callback.status,
  mode: callback.mode,
  name: callback.name,
  description: callback.description,
  metadata: callback.metadata,
  pollIntervalSecondsOverride: callback.pollIntervalSecondsOverride,
  providerDeploymentId: callback.providerDeployment.id,
  providerDeployment: providerDeploymentPresenter(callback.providerDeployment as any),
  triggers: callback.callbackTriggers.map(trigger => ({
    object: 'callback.trigger',
    id: trigger.id,
    providerTriggerId: trigger.providerTriggerId,
    providerTriggerKey: trigger.providerTriggerKey,
    providerTriggerName: trigger.providerTriggerName,
    eventTypes: trigger.eventTypes,
    createdAt: trigger.createdAt
  })),
  destinations: callback.callbackDestinationLinks.map(link =>
    callbackDestinationPresenter(link.callbackDestination)
  ),
  manualAttachmentCount: callback.callbackManualPairLinks.length,
  createdAt: callback.createdAt,
  updatedAt: callback.updatedAt
});
