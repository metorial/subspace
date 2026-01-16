import { canonicalize } from '@lowerdeck/canonicalize';
import { internalServerError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { db, getId, Session, SessionProvider, Solution, Tenant } from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../const';
import { env } from '../env';
import { ConResponse } from '../lib/response';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { sessionMessagePresenter } from '../presenter/sessionMessage';
import { toolNotFound } from '../types/error';
import { ConnectionResponse } from '../types/response';
import { WireInput, WireOutput } from '../types/wireMessage';

let instanceLock = createLock({
  name: 'conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let sender = wire.createSender();

export class SenderManager {
  readonly sender = sender;

  private constructor(
    readonly session: Session,
    readonly tenant: Tenant,
    readonly solution: Solution,
    readonly channelIds: string[]
  ) {}

  static async create(d: {
    sessionId: string;
    channelIds?: string[];
  }): Promise<SenderManager> {
    let session = await db.session.findFirst({
      where: {
        id: d.sessionId
      },
      include: {
        tenant: true,
        solution: true
      }
    });
    if (!session) throw new ServiceError(notFoundError('session'));

    return new SenderManager(session, session.tenant, session.solution, d.channelIds ?? []);
  }

  async ensureProviderInstance(provider: SessionProvider) {
    let currentInstance = await db.sessionProviderInstance.findFirst({
      where: {
        sessionProviderOid: provider.oid,
        expiresAt: { gt: new Date() }
      },
      include: { pairVersion: true }
    });
    if (currentInstance) return currentInstance;

    return instanceLock.usingLock(provider.id, async () => {
      let currentInstance = await db.sessionProviderInstance.findFirst({
        where: {
          sessionProviderOid: provider.oid,
          expiresAt: { gt: new Date() }
        },
        include: { pairVersion: true }
      });
      if (currentInstance) return currentInstance;

      let fullProvider = await db.sessionProvider.findFirstOrThrow({
        where: { oid: provider.oid },
        include: {
          deployment: true,
          config: true,
          provider: { include: { defaultVariant: { include: { currentVersion: true } } } }
        }
      });

      let version = await providerDeploymentInternalService.getCurrentVersion({
        deployment: fullProvider.deployment,
        provider: fullProvider.provider
      });

      let pair = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
        deployment: fullProvider.deployment,
        config: fullProvider.config,
        version
      });

      return await db.sessionProviderInstance.create({
        data: {
          ...getId('sessionProviderInstance'),
          sessionProviderOid: provider.oid,
          pairOid: pair.pair.oid,
          pairVersionOid: pair.version.oid,
          expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
        },
        include: { pairVersion: true }
      });
    });
  }

  async listToolsForProvider(provider: SessionProvider) {
    let instance = await this.ensureProviderInstance(provider);

    let tools = await db.providerTool.findMany({
      where: {
        specification: {
          providerVersions: {
            some: {
              oid: instance.pairVersion.versionOid
            }
          }
        }
      }
    });

    return tools.map(t => ({
      ...t,
      sessionProvider: provider,
      sessionProviderInstance: instance
    }));
  }

  async listTools() {
    let providers = await db.sessionProvider.findMany({
      where: { sessionOid: this.session.oid }
    });

    return await Promise.all(
      providers.map(provider => this.listToolsForProvider(provider))
    ).then(results => results.flat());
  }

  async getToolById(d: { toolId: string }) {
    let [providerTag, ...toolKeyParts] = d.toolId.split('_');
    let toolKey = toolKeyParts.join('_');

    // Find the provider by the tag
    let provider = await db.sessionProvider.findFirst({
      where: { sessionOid: this.session.oid, tag: providerTag }
    });
    if (!provider) return ConResponse.fail(toolNotFound(d.toolId));

    // Get the current instance for the provider
    let instance = await this.ensureProviderInstance(provider);
    if (!instance.pairVersion.specificationOid)
      throw new Error('Instance pair version missing specification OID');

    // Find the tool by key in the specification of the current instance
    let tool = await db.providerTool.findFirst({
      where: {
        key: toolKey,
        specificationOid: instance.pairVersion.specificationOid
      }
    });
    if (!tool) return ConResponse.fail(toolNotFound(d.toolId));

    return ConResponse.just({
      provider,
      instance,
      tool: {
        ...tool,
        sessionProvider: provider,
        sessionProviderInstance: instance
      }
    });
  }

  async callTool(d: {
    toolId: string;
    input: Record<string, any>;
    waitForResponse: boolean;
  }): Promise<ConnectionResponse> {
    let toolRes = await this.getToolById({ toolId: d.toolId });
    if (ConResponse.isError(toolRes)) return toolRes;

    let { provider, tool, instance } = toolRes.data!;

    let message = await db.sessionMessage.create({
      data: {
        ...getId('sessionMessage'),
        status: 'waiting_for_response',
        type: 'tool_call',
        input: d.input,
        toolKey: tool.key,
        toolOid: tool.oid,
        sessionOid: provider.sessionOid
      }
    });

    db.sessionEvent
      .createMany({
        data: {
          ...getId('sessionEvent'),
          type: 'message_processed',
          sessionOid: this.session.oid,
          messageOid: message.oid
        }
      })
      .catch(() => {});

    let processingPromise = (async () => {
      try {
        let res = await sender.send(topics.instance.encode({ instance }), {
          type: 'tool_call',
          sessionInstanceId: instance.id,
          sessionMessageId: message.id,
          channelIds: this.channelIds,

          toolCallableId: tool.callableId,
          toolId: d.toolId,
          toolKey: tool.key,

          input: d.input
        } satisfies WireInput);

        if (!res.success) {
          await db.sessionMessage.updateMany({
            where: { id: message.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              output: internalServerError({
                message: 'Failed to process tool call'
              }).toResponse()
            }
          });
        } else {
          let data = res.result as WireOutput;

          message.status = data.status;
          message.output = data.output;
          message.completedAt = new Date(data.completedAt);
        }

        console.log('Tool call response:', res);
      } catch (err) {
        console.error('Error sending tool call message:', err);
      }
    })();

    if (d.waitForResponse) {
      await processingPromise;
    }

    return ConResponse.just({
      message: sessionMessagePresenter(message),
      output: message.output
    });
  }

  async setClient(d: {
    client: {
      identifier: string;
      name: string;
      [key: string]: any;
    };
  }) {
    let hash = await Hash.sha256(canonicalize(d.client));

    let client = await db.sessionClient.upsert({
      where: {
        tenantOid_hash: {
          tenantOid: this.tenant.oid,
          hash
        }
      },
      create: {
        ...getId('sessionClient'),
        hash,
        identifier: d.client.identifier,
        name: d.client.name,
        payload: d.client,
        tenantOid: this.tenant.oid
      },
      update: {}
    });

    let ses = this.session;
    if (
      ses.clientOid != client.oid ||
      !ses.lastConnectionAt ||
      Math.abs(differenceInMinutes(new Date(), ses.lastConnectionAt)) > 5
    ) {
      let clientConnection = await db.sessionClientConnection.upsert({
        where: {
          clientOid_sessionOid: {
            clientOid: client.oid,
            sessionOid: this.session.oid
          }
        },
        update: {},
        create: {
          ...getId('sessionClientConnection'),
          clientOid: client.oid,
          sessionOid: this.session.oid
        }
      });

      await db.session.updateMany({
        where: { oid: this.session.oid },
        data: {
          clientOid: client.oid,
          connectionState: 'connected',
          lastConnectionAt: new Date(),
          lastPingAt: new Date()
        }
      });

      await db.sessionEvent.createMany({
        data: {
          ...getId('sessionEvent'),
          type: 'client_connected',
          sessionOid: this.session.oid,
          clientConnectionOid: clientConnection.oid
        }
      });
    }
  }
}
