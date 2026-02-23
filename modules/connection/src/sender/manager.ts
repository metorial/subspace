import {
  badRequestError,
  goneError,
  internalServerError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { ConduitInput, ConduitResult } from '@metorial-subspace/connection-utils';
import { checkToolAccess } from '@metorial-subspace/connection-utils';
import {
  db,
  getId,
  ID,
  type Session,
  type SessionConnection,
  type SessionConnectionMcpConnectionTransport,
  type SessionConnectionTransport,
  type SessionMessage,
  type SessionParticipant,
  type SessionProvider,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { isRecordDeleted } from '@metorial-subspace/list-utils';
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
import { conduit } from '../lib/conduit';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { createMessage, type CreateMessageProps } from '../shared/createMessage';
import { upsertParticipant } from '../shared/upsertParticipant';

let Sentry = getSentry();

let instanceLock = createLock({
  name: 'sub/conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let sender = conduit.createSender();

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
  input: PrismaJson.SessionMessageInput;
  waitForResponse: boolean;
  transport: SessionConnectionTransport;
  clientMcpId?: PrismaJson.SessionMessageClientMcpId;
  parentMessage?: SessionMessage;
}

export interface SenderMangerProps {
  sessionId: string;
  solutionId: string;
  tenantId: string;
  connectionToken?: string;
  transport: SessionConnectionTransport;
}

export class SenderManager {
  readonly sender = sender;

  private constructor(
    readonly session: Session,
    public connection:
      | (SessionConnection & { participant?: SessionParticipant | null })
      | undefined,
    readonly tenant: Tenant,
    readonly solution: Solution,
    readonly transport: SessionConnectionTransport
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
          ? {
              where: { token: d.connectionToken, status: { not: 'deleted' } },
              include: { participant: true }
            }
          : false
      }
    });
    if (!session) throw new ServiceError(notFoundError('session'));

    let connection = session.connections?.[0];
    if (d.connectionToken && !connection) {
      throw new ServiceError(notFoundError('connection'));
    }

    if (connection) {
      if (connection.isManuallyDisabled) {
        throw new ServiceError(goneError({ message: 'Connection has been disabled' }));
      }
      if (connection.status === 'archived') {
        throw new ServiceError(goneError({ message: 'Connection has been archived' }));
      }

      if (connection.expiresAt < new Date()) {
        if (connection.initState === 'pending') {
          throw new ServiceError(
            badRequestError({
              message: 'Connection not initialized in time'
            })
          );
        }

        await db.sessionConnection.updateMany({
          where: { oid: connection!.oid },
          data: {
            expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS)
          }
        });
      }

      if (connection.transport !== d.transport) {
        throw new ServiceError(
          badRequestError({
            message: `Connection cannot be used with transport ${d.transport}`
          })
        );
      }

      if (connection.state === 'disconnected') {
        (async () => {
          await db.sessionConnection.updateMany({
            where: { oid: connection.oid },
            data: {
              state: 'connected',
              lastActiveAt: new Date(),
              lastPingAt: new Date(),
              disconnectedAt: null
            }
          });

          await db.sessionEvent.createMany({
            data: {
              ...getId('sessionEvent'),
              type: 'connection_connected',
              sessionOid: session.oid,
              connectionOid: connection.oid,
              tenantOid: session.tenantOid,
              solutionOid: session.solutionOid,
              environmentOid: session.environmentOid
            }
          });
        })().catch(() => {});
      }
    }

    return new SenderManager(
      session,
      connection,
      session.tenant,
      session.solution,
      d.transport
    );
  }

  private async ensureProviderInstance(provider: SessionProvider) {
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
          environment: true,
          deployment: { include: { currentVersion: true } },
          config: { include: { currentVersion: true } },
          authConfig: { include: { currentVersion: true } },
          provider: { include: { defaultVariant: { include: { currentVersion: true } } } }
        }
      });

      let dependencyIsDeleted =
        isRecordDeleted(fullProvider.deployment) ||
        isRecordDeleted(fullProvider.config) ||
        isRecordDeleted(fullProvider.authConfig);
      if (dependencyIsDeleted) {
        await db.sessionProvider.updateMany({
          where: { oid: provider.oid },
          data: { status: 'archived' }
        });
        return null;
      }

      let version = await providerDeploymentInternalService.getCurrentVersion({
        environment: fullProvider.environment,
        deployment: fullProvider.deployment,
        provider: fullProvider.provider
      });
      if (!version?.specificationOid) {
        throw new ServiceError(badRequestError({ message: 'Provider has no usable version' }));
      }

      let pair = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
        deployment: fullProvider.deployment,
        authConfig: fullProvider.authConfig,
        config: fullProvider.config,
        version
      });

      return await db.sessionProviderInstance.create({
        data: {
          ...getId('sessionProviderInstance'),
          sessionProviderOid: provider.oid,
          sessionOid: provider.sessionOid,
          pairOid: pair.pair.oid,
          pairVersionOid: pair.version.oid,
          expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
        },
        include: { pairVersion: true }
      });
    });
  }

  private async listToolsForProvider(provider: SessionProvider) {
    let instance = await this.ensureProviderInstance(provider);
    if (!instance) return [];

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
      key: `${t.key}_${provider.tag}`,
      sessionProvider: provider,
      sessionProviderInstance: instance
    }));
  }

  async listProviders() {
    return await db.sessionProvider.findMany({
      where: { sessionOid: this.session.oid, status: 'active', isParentDeleted: false },
      include: { provider: true }
    });
  }

  async listToolsIncludingInternalAndNonAllowed() {
    let providers = await this.listProviders();
    return await Promise.all(
      providers.map(provider => this.listToolsForProvider(provider))
    ).then(results => results.flat().sort((a, b) => a.id.localeCompare(b.id)));
  }

  async listToolsIncludingInternal() {
    let allTools = await this.listToolsIncludingInternalAndNonAllowed();

    return allTools.filter(
      tool => checkToolAccess(tool, tool.sessionProvider, 'list').allowed
    );
  }

  async listTools() {
    let allTools = await this.listToolsIncludingInternal();
    console.log('listTools: allTools', serialize.encode(allTools));

    return allTools.filter(tool => {
      let mcpType = tool.value.mcpToolType.type;
      return mcpType !== 'mcp.logging_setLevel' && mcpType !== 'mcp.completion_complete';
    });
  }

  private async getProviderByTag(d: { tag: string }) {
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
    let parts = d.toolId.split('_');
    let providerTag = parts.pop();
    let toolKeyParts = parts;
    if (toolKeyParts.length === 0 || !providerTag?.trim()) {
      throw new ServiceError(badRequestError({ message: 'Invalid tool ID format' }));
    }

    let toolKey = toolKeyParts.join('_');

    let provider = await this.getProviderByTag({ tag: providerTag! });

    // Get the current instance for the provider
    let instance = await this.ensureProviderInstance(provider);
    if (!instance) throw new ServiceError(notFoundError('provider.instance'));

    if (!instance.pairVersion.specificationOid) {
      throw new ServiceError(
        badRequestError({ message: 'Tool not callable (not discovered yet)' })
      );
    }

    // Find the tool by key in the specification of the current instance
    let tool = await db.providerTool.findFirst({
      where: {
        key: toolKey,
        specificationOid: instance.pairVersion.specificationOid
      }
    });
    if (!tool) throw new ServiceError(notFoundError('tool', d.toolId));

    let { allowed } = checkToolAccess(tool, provider, 'call');
    if (!allowed) {
      throw new ServiceError(badRequestError({ message: 'Tool access not allowed' }));
    }

    return {
      provider,
      instance,
      tool: {
        ...tool,
        key: `${tool.key}_${provider.tag}`,
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
    console.log(
      'SENDER_MANAGER.callTool.1',
      serialize.encode({ input: d, connection: this.connection })
    );

    let connection = this.connection;
    if (!connection) {
      throw new ServiceError(
        badRequestError({ message: 'No connection id/token passed to connection' })
      );
    }
    if (connection.initState !== 'completed') {
      throw new ServiceError(badRequestError({ message: 'Connection is not initialized' }));
    }
    if (!connection.participant) {
      throw new Error('Connection participant not loaded');
    }

    let { provider, tool, instance } = await this.getToolById({ toolId: d.toolId });

    console.log(
      'SENDER_MANAGER.callTool.2',
      serialize.encode({ provider: provider.id, tool: tool.id, instance: instance.id })
    );

    let { allowed } = checkToolAccess(tool, provider, 'call');

    console.log('SENDER_MANAGER.callTool.3', serialize.encode({ allowed }));
    if (!allowed) {
      throw new ServiceError(badRequestError({ message: 'Tool access not allowed' }));
    }

    let message = await this.createMessage({
      status: 'waiting_for_response',
      type: d.transport === 'mcp' ? 'mcp_message' : 'tool_call',
      source: 'client',
      input: d.input,
      senderParticipant: connection.participant,
      clientMcpId: d.clientMcpId,
      transport: d.transport,
      tool,
      isProductive: true,
      provider,
      parentMessage: d.parentMessage
    });

    console.log('SENDER_MANAGER.callTool.4', serialize.encode({ message }));

    let processingPromise = (async () => {
      try {
        console.log('SENDER_MANAGER.callTool.5', serialize.encode({}));

        let res = await sender.send(topics.instance.encode({ instance, connection }), {
          type: 'tool_call',
          sessionInstanceId: instance.id,
          sessionMessageId: message.id,

          toolCallableId: tool.callableId,
          toolId: tool.id,
          toolKey: tool.key,

          input: d.input
        } satisfies ConduitInput);

        console.log('SENDER_MANAGER.callTool.6', serialize.encode({ res }));

        if (!res.success) {
          let system = await upsertParticipant({
            session: this.session,
            from: { type: 'system' }
          });

          console.log('SENDER_MANAGER.callTool.7', serialize.encode({ system }));

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
          let data = res.result as ConduitResult;
          message = Object.assign(message, {
            ...data.message,
            output: data.output ?? data.message?.output
          });
        }
      } catch (err) {
        Sentry.captureException(err);
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
    } satisfies ConduitResult;
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

          isEphemeral: this.session.isEphemeral,

          status: 'active',
          state: 'connected',
          initState: 'pending',
          transport: this.transport,

          isManuallyDisabled: false,
          isReplaced: false,

          mcpTransport: 'none',
          mcpProtocolVersion: null,

          sessionOid: this.session.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid,

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

  async setConnection(connection: SessionConnection) {
    this.connection = connection;
  }

  async disableConnection() {
    if (!this.connection) {
      throw new ServiceError(badRequestError({ message: 'No connection to disable' }));
    }

    this.connection = await db.sessionConnection.update({
      where: { oid: this.connection.oid },
      data: {
        isManuallyDisabled: true,
        state: 'disconnected',
        disconnectedAt: new Date()
      },
      include: { participant: true }
    });

    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'connection_disabled',
        sessionOid: this.session.oid,
        connectionOid: this.connection.oid,
        tenantOid: this.session.tenantOid,
        solutionOid: this.session.solutionOid,
        environmentOid: this.session.environmentOid
      }
    });
  }

  async initialize(d: InitProps & { isManualConnection?: boolean }) {
    // Ignore if already initialized
    if (this.connection?.initState === 'completed') return this.connection;

    if (d.client.identifier.startsWith('metorial#') && !d.isManualConnection) {
      throw new ServiceError(
        badRequestError({
          message: 'Client identifier cannot start with reserved prefix metorial#'
        })
      );
    }

    let participant = await upsertParticipant({
      session: this.session,
      from: d.client.identifier.startsWith('metorial#')
        ? { type: 'system' }
        : {
            type: 'connection_client',
            transport: d.mcpTransport === 'none' ? 'metorial' : 'mcp',
            participant: d.client
          }
    });

    let connectionData = {
      state: 'connected' as const,
      initState: 'completed' as const,
      isManuallyDisabled: false,

      sessionOid: this.session.oid,
      participantOid: participant.oid,

      mcpData: {
        clientInfo: {
          ...d.client,
          version: d.client.version ?? '1.0.0'
        },
        capabilities: d.mcpCapabilities,
        protocolVersion: d.mcpProtocolVersion
      },
      mcpProtocolVersion: d.mcpProtocolVersion,
      mcpTransport: d.mcpTransport,

      expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
      lastPingAt: new Date(),
      lastActiveAt: new Date(),
      disconnectedAt: null,

      transport: this.transport
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
          isForManualToolCalls: !!d.isManualConnection,
          isReplaced: false,
          isEphemeral: this.session.isEphemeral,
          status: 'active',
          tenantOid: this.tenant.oid,
          solutionOid: this.solution.oid,
          environmentOid: this.session.environmentOid,
          token: await ID.generateId('sessionConnection_token')
        }
      });
    }

    if (d.isManualConnection && !connection.isForManualToolCalls) {
      throw new ServiceError(
        internalServerError({ message: 'Connection cannot be used for manual tool calls' })
      );
    }

    await db.session.updateMany({
      where: { oid: this.session.oid },
      data: {
        lastConnectionCreatedAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    await db.sessionEvent.createMany({
      data: [
        {
          ...getId('sessionEvent'),
          type: 'connection_created',
          sessionOid: this.session.oid,
          connectionOid: connection.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid
        },
        {
          ...getId('sessionEvent'),
          type: 'connection_connected',
          sessionOid: this.session.oid,
          connectionOid: connection.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid
        }
      ]
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
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid
          }
        });
      }
    })().catch(() => {});

    this.connection = connection;

    return connection;
  }
}
