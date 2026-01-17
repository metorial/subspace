import {
  badRequestError,
  goneError,
  internalServerError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import {
  db,
  getId,
  ID,
  type Session,
  type SessionConnection,
  SessionConnectionMcpConnectionTransport,
  type SessionParticipant,
  type SessionProvider,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { addDays, addMinutes } from 'date-fns';
import {
  DEFAULT_SESSION_EXPIRATION_DAYS,
  SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT,
  UNINITIALIZED_SESSION_EXPIRATION_MINUTES
} from '../const';
import { env } from '../env';
import { topics } from '../lib/topic';
import { wire } from '../lib/wire';
import { completeMessage } from '../shared/completeMessage';
import { createMessage, type CreateMessageProps } from '../shared/createMessage';
import { upsertParticipant } from '../shared/upsertParticipant';
import type { WireInput, WireResult } from '../types/wireMessage';

let instanceLock = createLock({
  name: 'conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let sender = wire.createSender();

export interface InitProps {
  client: {
    identifier: string;
    name: string;
    [key: string]: any;
  };
  mcpCapabilities?: Record<string, any>;
  mcpProtocolVersion?: string;
  mcpTransport: SessionConnectionMcpConnectionTransport;
}

export interface CallToolProps {
  toolId: string;
  input: Record<string, any>;
  waitForResponse: boolean;
  isViaMcp: boolean;
  clientMcpId?: PrismaJson.SessionMessageClientMcpId;
}

export interface SenderMangerProps {
  sessionId: string;
  solutionId: string;
  tenantId: string;
  connectionToken?: string;
}

export class SenderManager {
  readonly sender = sender;

  private constructor(
    readonly session: Session,
    public connection:
      | (SessionConnection & { participant?: SessionParticipant | null })
      | undefined,
    readonly tenant: Tenant,
    readonly solution: Solution
  ) {}

  static async create(d: SenderMangerProps): Promise<SenderManager> {
    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
        solution: { OR: [{ id: d.solutionId }, { identifier: d.solutionId }] }
      },
      include: {
        tenant: true,
        solution: true,
        connections: d.connectionToken
          ? { where: { token: d.connectionToken }, include: { participant: true } }
          : false
      }
    });
    if (!session) throw new ServiceError(notFoundError('session'));

    let connection = session.connections?.[0];
    if (d.connectionToken && !connection) {
      throw new ServiceError(notFoundError('connection'));
    }

    if (connection && connection.isManuallyDisabled) {
      throw new ServiceError(
        goneError({
          message: 'Connection has been disabled'
        })
      );
    }

    if (connection && connection.expiresAt < new Date()) {
      if (connection.initState == 'pending') {
        throw new ServiceError(
          badRequestError({
            message: 'Connection not initialized in time'
          })
        );
      }

      connection = await withTransaction(async db => {
        await db.sessionConnection.updateMany({
          where: { oid: connection!.oid },
          data: {
            token: await ID.generateId('sessionConnection_token'),
            isReplaced: true
          }
        });

        return await db.sessionConnection.create({
          data: {
            ...getId('sessionConnection'),

            // We move the token to a new connection after a certain time
            // to prevent stale connections from being reused
            token: d.connectionToken!,
            mcpTransport: connection!.mcpTransport,
            mcpProtocolVersion: connection!.mcpProtocolVersion,

            status: 'active',
            state: 'connected' as const,
            initState: connection!.initState,
            isManuallyDisabled: false,
            isReplaced: false,

            sessionOid: session.oid,
            participantOid: connection!.participantOid,
            tenantOid: session.tenantOid,
            solutionOid: session.solutionOid,

            mcpData: connection!.mcpData,

            expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
            lastPingAt: new Date()
          }
        });
      });
    }

    return new SenderManager(session, connection, session.tenant, session.solution);
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

  async listProviders() {
    return await db.sessionProvider.findMany({
      where: { sessionOid: this.session.oid, status: 'active' },
      include: { provider: true }
    });
  }

  async listTools() {
    let providers = await this.listProviders();
    return await Promise.all(
      providers.map(provider => this.listToolsForProvider(provider))
    ).then(results => results.flat());
  }

  async getProviderByTag(d: { tag: string }) {
    let provider = await db.sessionProvider.findFirst({
      where: {
        sessionOid: this.session.oid,
        tag: d.tag,
        status: 'active'
      }
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.tag));
    return provider;
  }

  async getToolById(d: { toolId: string }) {
    let [providerTag, ...toolKeyParts] = d.toolId.split('_');
    let toolKey = toolKeyParts.join('_');

    let provider = await this.getProviderByTag({ tag: providerTag! });

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
    if (!tool) throw new ServiceError(notFoundError('tool', d.toolId));

    return {
      provider,
      instance,
      tool: {
        ...tool,
        sessionProvider: provider,
        sessionProviderInstance: instance
      }
    };
  }

  async createMessage(d: CreateMessageProps) {
    return await createMessage({
      ...d,
      session: this.session,
      connection: this.connection ?? null
    });
  }

  async callTool(d: CallToolProps) {
    let connection = this.connection;
    if (!connection) {
      throw new ServiceError(
        badRequestError({ message: 'No connection id/token passed to connection' })
      );
    }
    if (!connection.participant || connection.initState != 'completed') {
      throw new ServiceError(badRequestError({ message: 'Connection is not initialized' }));
    }

    let { provider, tool, instance } = await this.getToolById({ toolId: d.toolId });

    let message = await this.createMessage({
      status: 'waiting_for_response',
      type: 'tool_call',
      source: 'client',
      input: {
        type: 'tool.call',
        data: d.input
      },
      senderParticipant: connection.participant,
      clientMcpId: d.clientMcpId,
      isViaMcp: d.isViaMcp,
      tool,
      isProductive: true,
      provider
    });

    let processingPromise = (async () => {
      try {
        let res = await sender.send(topics.instance.encode({ instance, connection }), {
          type: 'tool_call',
          sessionInstanceId: instance.id,
          sessionMessageId: message.id,

          toolCallableId: tool.callableId,
          toolId: d.toolId,
          toolKey: tool.key,

          input: d.input
        } satisfies WireInput);

        if (!res.success) {
          let system = await upsertParticipant({
            session: this.session,
            from: { type: 'system' }
          });

          await completeMessage(
            { messageId: message.id },
            {
              status: 'failed',
              completedAt: new Date(),
              failureReason: 'system_error',
              responderParticipant: system,
              output: {
                type: 'error',
                data: internalServerError({
                  message: 'Failed to process tool call'
                }).toResponse()
              }
            }
          );
        } else {
          let data = res.result as WireResult;
          message = Object.assign(message, {
            ...data.message,
            output: data.output ?? data.message?.output
          });
        }
      } catch (err) {
        console.error('Error sending tool call message:', err);
      }
    })();

    if (d.waitForResponse) {
      await processingPromise;
    }

    return {
      message,
      output: message.output,
      status: message.status,
      completedAt: message.completedAt
    } satisfies WireResult;
  }

  #createConnectionPromise: Promise<SessionConnection> | null = null;
  async createConnection() {
    if (this.connection) return this.connection;
    if (this.#createConnectionPromise) return await this.#createConnectionPromise;

    let con = db.sessionConnection
      .create({
        data: {
          ...getId('sessionConnection'),

          token: await ID.generateId('sessionConnection_token'),

          status: 'active',
          state: 'connected',
          initState: 'pending',
          isManuallyDisabled: false,
          isReplaced: false,

          mcpTransport: 'none',
          mcpProtocolVersion: null,

          sessionOid: this.session.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,

          mcpData: {},

          expiresAt: addMinutes(new Date(), UNINITIALIZED_SESSION_EXPIRATION_MINUTES),
          lastPingAt: new Date()
        }
      })
      .then(c => c); // Force promise to run

    this.#createConnectionPromise = con;
    this.connection = await con;

    return this.connection;
  }

  async initialize(d: InitProps) {
    // Ignore if already initialized
    if (this.connection?.initState == 'completed') return this.connection;

    let participant = await upsertParticipant({
      session: this.session,
      from: {
        type: 'connection_client',
        transport: d.mcpTransport == 'none' ? 'metorial' : 'mcp',
        participant: d.client
      }
    });

    let connectionData = {
      state: 'connected' as const,
      initState: 'completed' as const,
      isManuallyDisabled: false,

      sessionOid: this.session.oid,
      clientOid: participant.oid,

      mcpData: {
        capabilities: d.mcpCapabilities,
        protocolVersion: d.mcpProtocolVersion
      },
      mcpProtocolVersion: d.mcpProtocolVersion,
      mcpTransport: d.mcpTransport,

      expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
      lastPingAt: new Date()
    };

    let connection: SessionConnection;
    if (this.connection) {
      connection = await db.sessionConnection.update({
        where: { oid: this.connection.oid },
        data: connectionData
      });
    } else {
      connection = await db.sessionConnection.create({
        data: {
          ...getId('sessionConnection'),
          ...connectionData,
          isReplaced: false,
          status: 'active',
          tenantOid: this.tenant.oid,
          solutionOid: this.solution.oid,
          token: await ID.generateId('sessionConnection_token')
        }
      });
    }

    await db.session.updateMany({
      where: { oid: this.session.oid },
      data: {
        lastConnectionCreatedAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'connection_created',
        sessionOid: this.session.oid,
        connectionOid: connection.oid,
        tenantOid: this.session.tenantOid,
        solutionOid: this.session.solutionOid
      }
    });

    (async () => {
      let res = await db.session.updateMany({
        where: { oid: this.session.oid, isStarted: false },
        data: { isStarted: true }
      });
      if (res.count > 0) {
        await db.sessionEvent.createMany({
          data: {
            ...getId('sessionEvent'),
            type: 'session_started',
            sessionOid: this.session.oid,
            tenantOid: this.session.tenantOid,
            solutionOid: this.session.solutionOid
          }
        });
      }
    })().catch(() => {});

    this.connection = connection;

    return connection;
  }
}
