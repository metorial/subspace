import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  CallbackDestinationStatus,
  CallbackMode,
  CallbackStatus,
  db,
  getId,
  snowflake,
  type ProviderDeployment,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { callbackRegistrationService } from './callbackRegistration';

const MAX_DESTINATIONS_PER_CALLBACK = 100;

let callbackInclude = {
  providerDeployment: {
    include: {
      provider: {
        include: {
          type: true
        }
      },
      currentVersion: true
    }
  },
  callbackTriggers: true,
  callbackDestinationLinks: {
    include: {
      callbackDestination: true
    }
  },
  callbackManualPairLinks: {
    include: {
      providerDeploymentConfigPair: true
    }
  }
};

class callbackServiceImpl {
  private normalizePollInterval(value?: number | null) {
    if (value === undefined || value === null) return value;
    if (!Number.isInteger(value) || value < 1) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_poll_interval',
          message: 'pollIntervalSecondsOverride must be a positive integer.'
        })
      );
    }

    return value;
  }

  async listCallbacks(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeploymentIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callback.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            status: { notIn: [CallbackStatus.deleted] },
            ...(d.providerDeploymentIds?.length
              ? {
                  providerDeployment: {
                    id: {
                      in: d.providerDeploymentIds
                    }
                  }
                }
              : {})
          },
          include: callbackInclude
        })
      )
    );
  }

  async getCallbackById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
  }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: { notIn: [CallbackStatus.deleted] }
      },
      include: callbackInclude
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    return callback;
  }

  private async getDeploymentAndValidate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeploymentId: string;
  }) {
    let providerDeployment = await db.providerDeployment.findFirst({
      where: {
        id: d.providerDeploymentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include: {
        provider: {
          include: {
            type: true,
            defaultVariant: true
          }
        },
        currentVersion: {
          include: {
            lockedVersion: true
          }
        }
      }
    });
    if (!providerDeployment) {
      throw new ServiceError(notFoundError('provider.deployment', d.providerDeploymentId));
    }

    if (
      providerDeployment.provider.type.attributes.backend !== 'slates' ||
      providerDeployment.provider.type.attributes.triggers.status !== 'enabled'
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_not_supported',
          message: 'Callbacks are only supported for trigger-enabled slates providers.'
        })
      );
    }

    return providerDeployment;
  }

  private async resolveTriggerDefs(d: {
    environment: Environment;
    deployment: ProviderDeployment;
    inputTriggers: { triggerId: string; eventTypes?: string[] }[];
  }) {
    let deployment = await db.providerDeployment.findFirstOrThrow({
      where: { oid: d.deployment.oid },
      include: {
        provider: {
          include: {
            defaultVariant: {
              include: {
                currentVersion: true
              }
            }
          }
        },
        currentVersion: {
          include: {
            lockedVersion: true
          }
        }
      }
    });

    let version = await providerDeploymentInternalService.getCurrentVersion({
      provider: deployment.provider,
      environment: d.environment,
      deployment
    });
    if (!version?.specificationOid) {
      throw new ServiceError(
        badRequestError({
          code: 'missing_specification',
          message: 'Deployment has no discovered specification with triggers.'
        })
      );
    }

    let specification = await db.providerSpecification.findFirstOrThrow({
      where: { oid: version.specificationOid }
    });

    let triggers = specification.value.specification.triggers ?? [];
    let byMatcher = new Map<string, (typeof triggers)[number]>();
    for (let trigger of triggers) {
      byMatcher.set(trigger.key, trigger);
      byMatcher.set(trigger.specId, trigger);
      byMatcher.set(trigger.callableId, trigger);
      if (trigger.specUniqueIdentifier) {
        byMatcher.set(trigger.specUniqueIdentifier, trigger);
      }
    }

    return d.inputTriggers.map(item => {
      let trigger = byMatcher.get(item.triggerId);
      if (!trigger) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_callback_trigger',
            message: `Trigger not found in provider specification: ${item.triggerId}`
          })
        );
      }

      return {
        providerTriggerId: trigger.specId,
        providerTriggerKey: trigger.key,
        providerTriggerName: trigger.name,
        eventTypes: item.eventTypes?.length ? item.eventTypes : []
      };
    });
  }

  async createCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      providerDeploymentId: string;
      mode: CallbackMode;
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      pollIntervalSecondsOverride?: number | null;
      triggers: { triggerId: string; eventTypes?: string[] }[];
      destinationIds: string[];
    };
  }) {
    let providerDeployment = await this.getDeploymentAndValidate({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providerDeploymentId: d.input.providerDeploymentId
    });

    let callbackTriggers = await this.resolveTriggerDefs({
      environment: d.environment,
      deployment: providerDeployment,
      inputTriggers: d.input.triggers
    });
    let destinationIds = [...new Set(d.input.destinationIds)];
    if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_destination_limit_exceeded',
          message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
        })
      );
    }
    let pollIntervalSecondsOverride = this.normalizePollInterval(
      d.input.pollIntervalSecondsOverride
    );

    let destinations = await db.callbackDestination.findMany({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        id: { in: destinationIds },
        status: CallbackDestinationStatus.active
      }
    });
    if (destinations.length !== destinationIds.length) {
      throw new ServiceError(
        badRequestError({ message: 'One or more callback destinations were not found.' })
      );
    }

    let callback = await db.callback.create({
      data: {
        ...getId('callback'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        providerDeploymentOid: providerDeployment.oid,
        status: CallbackStatus.active,
        mode: d.input.mode,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        pollIntervalSecondsOverride,
        callbackTriggers: {
          create: callbackTriggers.map(trigger => ({
            ...getId('callbackTrigger'),
            providerTriggerId: trigger.providerTriggerId,
            providerTriggerKey: trigger.providerTriggerKey,
            providerTriggerName: trigger.providerTriggerName,
            eventTypes: trigger.eventTypes
          }))
        },
        callbackDestinationLinks: {
          create: destinations.map(destination => ({
            oid: snowflake.nextId(),
            callbackDestinationOid: destination.oid
          }))
        }
      }
    });

    await callbackRegistrationService.enqueueReconcile({ callbackId: callback.id });

    return await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: callback.id
    });
  }

  async updateCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    input: {
      mode?: CallbackMode;
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      pollIntervalSecondsOverride?: number | null;
      triggers?: { triggerId: string; eventTypes?: string[] }[];
      destinationIds?: string[];
    };
  }) {
    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });
    let pollIntervalSecondsOverride =
      d.input.pollIntervalSecondsOverride !== undefined
        ? this.normalizePollInterval(d.input.pollIntervalSecondsOverride)
        : undefined;

    let destinationOids: bigint[] | undefined;
    if (d.input.destinationIds) {
      let destinationIds = [...new Set(d.input.destinationIds)];
      if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
        throw new ServiceError(
          badRequestError({
            code: 'callback_destination_limit_exceeded',
            message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
          })
        );
      }
      let destinations = await db.callbackDestination.findMany({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          id: { in: destinationIds },
          status: CallbackDestinationStatus.active
        }
      });
      if (destinations.length !== destinationIds.length) {
        throw new ServiceError(
          badRequestError({ message: 'One or more callback destinations were not found.' })
        );
      }
      destinationOids = destinations.map(dest => dest.oid);
    }

    let triggerDefs =
      d.input.triggers !== undefined
        ? await this.resolveTriggerDefs({
            environment: d.environment,
            deployment: callback.providerDeployment,
            inputTriggers: d.input.triggers
          })
        : undefined;

    await db.$transaction(async tx => {
      await tx.callback.update({
        where: { oid: callback.oid },
        data: {
          mode: d.input.mode ?? undefined,
          name: d.input.name ?? undefined,
          description: d.input.description ?? undefined,
          metadata: d.input.metadata ?? undefined,
          pollIntervalSecondsOverride: pollIntervalSecondsOverride ?? undefined
        }
      });

      if (destinationOids) {
        await tx.callbackDestinationLink.deleteMany({ where: { callbackOid: callback.oid } });
        if (destinationOids.length) {
          await tx.callbackDestinationLink.createMany({
            data: destinationOids.map(destinationOid => ({
              oid: snowflake.nextId(),
              callbackOid: callback.oid,
              callbackDestinationOid: destinationOid
            }))
          });
        }
      }

      if (triggerDefs) {
        await tx.callbackTrigger.deleteMany({ where: { callbackOid: callback.oid } });
        if (triggerDefs.length) {
          await tx.callbackTrigger.createMany({
            data: triggerDefs.map(trigger => ({
              ...getId('callbackTrigger'),
              callbackOid: callback.oid,
              providerTriggerId: trigger.providerTriggerId,
              providerTriggerKey: trigger.providerTriggerKey,
              providerTriggerName: trigger.providerTriggerName,
              eventTypes: trigger.eventTypes
            }))
          });
        }
      }
    });

    await callbackRegistrationService.enqueueReconcile({ callbackId: callback.id });

    return await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: callback.id
    });
  }

  async archiveCallback(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
  }) {
    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });

    let archived = await db.callback.update({
      where: { oid: callback.oid },
      data: { status: CallbackStatus.archived },
      include: callbackInclude
    });

    await callbackRegistrationService.enqueueReconcile({ callbackId: archived.id });

    return archived;
  }

  async listAttachments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
  }) {
    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });

    return await db.callbackManualPairLink.findMany({
      where: { callbackOid: callback.oid },
      include: {
        providerDeploymentConfigPair: {
          include: {
            providerConfigVersion: {
              include: {
                config: true
              }
            },
            providerAuthConfigVersion: {
              include: {
                authConfig: true
              }
            }
          }
        }
      }
    });
  }

  async attachPair(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    configId: string;
    authConfigId?: string;
  }) {
    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });

    let config = await db.providerConfig.findFirst({
      where: {
        id: d.configId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        deploymentOid: callback.providerDeploymentOid
      },
      include: { currentVersion: true }
    });
    if (!config?.currentVersion) {
      throw new ServiceError(notFoundError('provider.config', d.configId));
    }

    let authConfig = d.authConfigId
      ? await db.providerAuthConfig.findFirst({
          where: {
            id: d.authConfigId,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            deploymentOid: callback.providerDeploymentOid
          },
          include: { currentVersion: true }
        })
      : null;

    if (d.authConfigId && !authConfig?.currentVersion) {
      throw new ServiceError(notFoundError('provider.auth_config', d.authConfigId));
    }

    let pairRes = await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair(
      {
        deployment: callback.providerDeployment,
        config,
        authConfig
      }
    );

    await db.callbackManualPairLink.upsert({
      where: {
        callbackOid_providerDeploymentConfigPairOid: {
          callbackOid: callback.oid,
          providerDeploymentConfigPairOid: pairRes.pair.oid
        }
      },
      create: {
        oid: snowflake.nextId(),
        callbackOid: callback.oid,
        providerDeploymentConfigPairOid: pairRes.pair.oid
      },
      update: {}
    });

    await callbackRegistrationService.enqueueReconcile({
      callbackId: callback.id,
      providerDeploymentConfigPairId: pairRes.pair.id
    });

    return await this.listAttachments({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });
  }

  async detachPair(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    providerDeploymentConfigPairId: string;
  }) {
    let callback = await this.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });

    await db.callbackManualPairLink.deleteMany({
      where: {
        callbackOid: callback.oid,
        providerDeploymentConfigPair: {
          id: d.providerDeploymentConfigPairId
        }
      }
    });

    await callbackRegistrationService.enqueueReconcile({
      callbackId: callback.id,
      providerDeploymentConfigPairId: d.providerDeploymentConfigPairId
    });

    return await this.listAttachments({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      callbackId: d.callbackId
    });
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
