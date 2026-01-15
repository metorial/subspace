import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { db, getId, Session, SessionProvider, Solution, Tenant } from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../const';
import { env } from '../env';
import { Response } from '../lib/response';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { sessionMessagePresenter } from '../presenter/sessionMessage';
import { toolNotFound } from '../types/error';
import { ConnectionResponse } from '../types/response';
import { WireInput } from '../types/wireMessage';

let instanceLock = createLock({
  name: 'conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let sender = wire.createSender();

export class SenderManager {
  private constructor(
    readonly session: Session,
    readonly tenant: Tenant,
    readonly solution: Solution
  ) {}

  static async create(d: { sessionId: string }): Promise<SenderManager> {
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

    return new SenderManager(session, session.tenant, session.solution);
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

  async callTool(d: {
    toolId: string;
    input: Record<string, any>;
  }): Promise<ConnectionResponse> {
    let [providerTag, ...toolKeyParts] = d.toolId.split('_');
    let toolKey = toolKeyParts.join('_');

    // Find the provider by the tag
    let provider = await db.sessionProvider.findFirst({
      where: { sessionOid: this.session.oid, tag: providerTag }
    });
    if (!provider) return Response.fail(toolNotFound(d.toolId));

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
    if (!tool) return Response.fail(toolNotFound(d.toolId));

    let message = await db.sessionMessage.create({
      data: {
        ...getId('sessionMessage'),
        status: 'waiting_for_response',
        type: 'tool_call',
        input: d.input,
        toolKey,
        toolOid: tool.oid,
        sessionOid: provider.sessionOid
      }
    });

    await (async () => {
      try {
        let res = await sender.send(topics.encode({ instance }), {
          type: 'tool_call',
          sessionInstanceId: instance.id,
          sessionMessageId: message.id,

          toolCallableId: tool.callableId,
          toolId: d.toolId,
          toolKey: toolKey,

          input: d.input
        } satisfies WireInput);

        console.log('Tool call response:', res);
      } catch (err) {
        console.error('Error sending tool call message:', err);
      }
    })();

    return Response.just({
      message: sessionMessagePresenter(message)
    });
  }
}
