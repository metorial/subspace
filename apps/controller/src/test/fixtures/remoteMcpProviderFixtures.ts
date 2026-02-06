import { delay } from '@lowerdeck/delay';
import { generateCode } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { createShuttleClient } from '@metorial-services/shuttle-client';
import {
  getId,
  snowflake,
  type Backend,
  type Environment,
  type PrismaClient,
  type Provider,
  type ProviderAuthConfigVersion,
  type ProviderConfig,
  type ProviderConfigVersion,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderSpecification,
  type ProviderVariant,
  type ProviderVersion,
  type ShuttleServer,
  type ShuttleServerVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  providerDeploymentConfigPairInternalService,
  providerInternalService,
  providerSpecificationInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { getBackend } from '@metorial-subspace/provider';
import { EnvironmentFixtures } from './environmentFixtures';
import { SolutionFixtures } from './solutionFixtures';
import { TenantFixtures } from './tenantFixtures';

type RemoteMcpProviderResult = {
  solution: Solution;
  tenant: Tenant;
  environment: Environment;
  backend: Backend;
  shuttleServer: ShuttleServer;
  shuttleServerVersion: ShuttleServerVersion;
  provider: Provider;
  providerVersion: ProviderVersion;
  specification: ProviderSpecification;
  providerDeployment: ProviderDeployment;
  providerConfig: ProviderConfig;
};

type RemoteMcpProviderOptions = {
  remoteUrl: string;
  protocol?: 'sse' | 'streamable_http';
  solution?: Solution;
  tenant?: Tenant;
  environment?: Environment;
};

const getShuttleClient = () => {
  const endpoint = process.env.SHUTTLE_URL;
  if (!endpoint) {
    throw new Error('SHUTTLE_URL is required to create a remote MCP provider');
  }
  return createShuttleClient({ endpoint });
};

const ensureBackend = async (db: PrismaClient): Promise<Backend> => {
  let ids = getId('backend');
  return db.backend.upsert({
    where: { type: 'shuttle' },
    create: {
      ...ids,
      type: 'shuttle',
      identifier: 'shuttle',
      name: 'Shuttle'
    },
    update: {}
  });
};

const ensureShuttleTenant = async (db: PrismaClient, tenant: Tenant) => {
  if (tenant.shuttleTenantId && tenant.shuttleTenantIdentifier) {
    return {
      id: tenant.shuttleTenantId,
      identifier: tenant.shuttleTenantIdentifier
    };
  }

  let shuttleClient = getShuttleClient();
  let shuttleTenant = await (async () => {
    let start = Date.now();
    let lastError: unknown;

    while (true) {
      try {
        return await shuttleClient.tenant.upsert({
          identifier: tenant.identifier,
          name: tenant.name
        });
      } catch (err) {
        lastError = err;
        if (Date.now() - start > 30000) {
          throw new Error(
            `Shuttle not reachable at ${process.env.SHUTTLE_URL}. ` +
              `Last error: ${(lastError as Error)?.message ?? String(lastError)}`
          );
        }
        await delay(500);
      }
    }
  })();

  let updatedTenant = await db.tenant.update({
    where: { oid: tenant.oid },
    data: {
      shuttleTenantId: shuttleTenant.id,
      shuttleTenantIdentifier: shuttleTenant.identifier
    }
  });

  return {
    id: updatedTenant.shuttleTenantId!,
    identifier: updatedTenant.shuttleTenantIdentifier!
  };
};

const waitForDeploymentVersion = async (opts: {
  tenantId: string;
  deploymentId: string;
  timeoutMs?: number;
}) => {
  let timeoutMs = opts.timeoutMs ?? 30000;
  let start = Date.now();
  let shuttleClient = getShuttleClient();

  while (true) {
    let deployment = await shuttleClient.serverDeployment.get({
      tenantId: opts.tenantId,
      serverDeploymentId: opts.deploymentId
    });

    if (deployment.status === 'failed') {
      throw new Error('Shuttle deployment failed while creating remote MCP server');
    }

    if (deployment.status === 'succeeded' && deployment.serverVersionId) {
      return deployment.serverVersionId;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for shuttle server version');
    }

    await delay(500);
  }
};

const ensureShuttleServerRecords = async (db: PrismaClient, d: {
  serverId: string;
  serverType: 'container' | 'function' | 'remote';
  tenantId?: string | null;
  versionId: string;
}) => {
  let shuttleServer = await db.shuttleServer.upsert({
    where: { id: d.serverId },
    create: {
      oid: snowflake.nextId(),
      id: d.serverId,
      identifier: d.serverId,
      shuttleTenantId: d.tenantId ?? null,
      type: d.serverType
    },
    update: {}
  });

  let shuttleServerVersion = await db.shuttleServerVersion.upsert({
    where: { id: d.versionId },
    create: {
      oid: snowflake.nextId(),
      id: d.versionId,
      version: d.versionId,
      identifier: `${d.serverId}::${d.versionId}`,
      serverOid: shuttleServer.oid
    },
    update: {}
  });

  return { shuttleServer, shuttleServerVersion };
};

const DISCOVERY_TIMEOUT_MS = 30000;
const DISCOVERY_CALL_TIMEOUT_MS = 10000;

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    let timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

const getStableRemoteServerName = () => 'Subspace Test Remote MCP';

const findRemoteServerByName = async (opts: {
  shuttleClient: ReturnType<typeof createShuttleClient>;
  tenantId: string;
  serverName: string;
}) => {
  let cursor: string | undefined;

  for (let i = 0; i < 20; i++) {
    let page = await opts.shuttleClient.server.list({
      tenantId: opts.tenantId,
      limit: 100,
      cursor
    });

    let match = page.items.find(item => item.type === 'remote' && item.name === opts.serverName);
    if (match) return match;

    if (!page.pagination.has_more_after) {
      return null;
    }

    cursor = page.items[page.items.length - 1]?.id;
    if (!cursor) {
      return null;
    }
  }

  return null;
};

const ensureRemoteServerVersion = async (opts: {
  shuttleClient: ReturnType<typeof createShuttleClient>;
  tenantId: string;
  remoteUrl: string;
  protocol: 'sse' | 'streamable_http';
}) => {
  let serverName = getStableRemoteServerName();
  let existing = await findRemoteServerByName({
    shuttleClient: opts.shuttleClient,
    tenantId: opts.tenantId,
    serverName
  });

  if (!existing) {
    let { server, deployment } = await opts.shuttleClient.server.create({
      tenantId: opts.tenantId,
      name: serverName,
      description: 'Fixture remote MCP server',
      from: {
        type: 'remote',
        remoteUrl: opts.remoteUrl,
        protocol: opts.protocol,
        config: {}
      }
    });

    let serverVersionId = deployment.serverVersionId
      ? deployment.serverVersionId
      : await waitForDeploymentVersion({
          tenantId: opts.tenantId,
          deploymentId: deployment.id
        });

    return { server, serverVersionId };
  }

  let server = await opts.shuttleClient.server.get({
    tenantId: opts.tenantId,
    serverId: existing.id
  });

  let needsNewVersion =
    !server.currentVersionId ||
    server.draft.remoteUrl !== opts.remoteUrl ||
    server.draft.remoteProtocol !== opts.protocol;

  if (needsNewVersion) {
    let deployment = await opts.shuttleClient.server.createVersion({
      tenantId: opts.tenantId,
      serverId: existing.id,
      from: {
        type: 'remote',
        remoteUrl: opts.remoteUrl,
        protocol: opts.protocol
      }
    });

    let serverVersionId = deployment.serverVersionId
      ? deployment.serverVersionId
      : await waitForDeploymentVersion({
          tenantId: opts.tenantId,
          deploymentId: deployment.id
        });

    server = await opts.shuttleClient.server.get({
      tenantId: opts.tenantId,
      serverId: existing.id
    });

    return { server, serverVersionId };
  }

  return { server, serverVersionId: server.currentVersionId! };
};

const waitForPairVersionDiscovery = async (
  db: PrismaClient,
  pairVersionOid: bigint,
  timeoutMs: number = DISCOVERY_TIMEOUT_MS
) => {
  let start = Date.now();

  while (true) {
    let pairVersion = await db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow({
      where: { oid: pairVersionOid }
    });

    if (pairVersion.specificationDiscoveryStatus !== 'discovering') {
      return pairVersion;
    }

    if (Date.now() - start > timeoutMs) {
      return pairVersion;
    }

    await delay(1000);
  }
};

const discoverVersionSpecification = async (d: {
  tenant: Tenant;
  provider: Provider;
  providerVersion: ProviderVersion;
  providerVariant: ProviderVariant;
}) => {
  let backend = await getBackend({ entity: d.providerVariant });
  let start = Date.now();
  let lastError: unknown;

  while (true) {
    try {
      let capabilities = await withTimeout(
        backend.capabilities.getSpecificationForProviderVersion({
          tenant: d.tenant,
          provider: d.provider,
          providerVariant: d.providerVariant,
          providerVersion: d.providerVersion
        }),
        DISCOVERY_CALL_TIMEOUT_MS,
        'provider version discovery call'
      );

      if (capabilities) {
        return await providerSpecificationInternalService.ensureProviderSpecification({
          provider: d.provider,
          providerVersion: d.providerVersion,
          type: capabilities.type,
          specification: capabilities.specification,
          authMethods: capabilities.authMethods,
          features: capabilities.features,
          tools: capabilities.tools
        });
      }
    } catch (err) {
      lastError = err;
    }

    if (Date.now() - start > DISCOVERY_TIMEOUT_MS) {
      let message = (lastError as Error)?.message ?? String(lastError ?? 'none');
      throw new Error(
        `Timed out waiting for Shuttle version specification discovery. Last error: ${message}`
      );
    }

    await delay(1000);
  }
};

const discoverPairSpecification = async (d: {
  tenant: Tenant;
  provider: Provider;
  providerVersion: ProviderVersion;
  providerVariant: ProviderVariant;
  deploymentVersion: ProviderDeploymentVersion;
  configVersion: ProviderConfigVersion;
  authConfigVersion: ProviderAuthConfigVersion | null;
}) => {
  let backend = await getBackend({ entity: d.providerVariant });
  let start = Date.now();
  let lastError: unknown;

  while (true) {
    try {
      let capabilities = await withTimeout(
        backend.capabilities.getSpecificationForProviderPair({
          tenant: d.tenant,
          provider: d.provider,
          providerVariant: d.providerVariant,
          providerVersion: d.providerVersion,
          deploymentVersion: d.deploymentVersion,
          configVersion: d.configVersion,
          authConfigVersion: d.authConfigVersion
        }),
        DISCOVERY_CALL_TIMEOUT_MS,
        'provider pair discovery call'
      );

      if (capabilities) {
        return await providerSpecificationInternalService.ensureProviderSpecification({
          provider: d.provider,
          providerVersion: d.providerVersion,
          type: capabilities.type,
          specification: capabilities.specification,
          authMethods: capabilities.authMethods,
          features: capabilities.features,
          tools: capabilities.tools
        });
      }
    } catch (err) {
      lastError = err;
    }

    if (Date.now() - start > DISCOVERY_TIMEOUT_MS) {
      let message = (lastError as Error)?.message ?? String(lastError ?? 'none');
      throw new Error(`Timed out waiting for Shuttle specification discovery. Last error: ${message}`);
    }

    await delay(1000);
  }
};

export const RemoteMcpProviderFixtures = (db: PrismaClient) => {
  const complete = async (opts: RemoteMcpProviderOptions): Promise<RemoteMcpProviderResult> => {
    let shuttleClient = getShuttleClient();

    let solutionFixtures = SolutionFixtures(db);
    let tenantFixtures = TenantFixtures(db);
    let environmentFixtures = EnvironmentFixtures(db);

    let solution = opts.solution ?? (await solutionFixtures.default());
    let tenant = opts.tenant ?? (await tenantFixtures.default());
    let environment =
      opts.environment ?? (await environmentFixtures.default({ tenant }));

    let backend = await ensureBackend(db);

    let shuttleTenant = await ensureShuttleTenant(db, tenant);

    let protocol = opts.protocol ?? 'streamable_http';
    let { server, serverVersionId } = await ensureRemoteServerVersion({
      shuttleClient,
      tenantId: shuttleTenant.id,
      remoteUrl: opts.remoteUrl,
      protocol
    });

    let version = await shuttleClient.serverVersion.get({
      tenantId: shuttleTenant.id,
      serverVersionId
    });

    let { shuttleServer, shuttleServerVersion } = await ensureShuttleServerRecords(db, {
      serverId: server.id,
      serverType: server.type,
      tenantId: server.tenantId,
      versionId: version.id
    });

    let publisher = await publisherInternalService.upsertPublisherForExternal({
      identifier: `shuttle::remote::${opts.remoteUrl}`,
      name: `MCP Remote (${opts.remoteUrl})`
    });

    let provider = await providerInternalService.upsertProvider({
      publisher,
      tenant,
      source: {
        type: 'shuttle',
        shuttleServer,
        backend
      },
      info: {
        name: server.name,
        description: server.description ?? undefined,
        slug: slugify(`${server.name}-${generateCode(5)}`)
      },
      type: {
        name: 'MCP',
        attributes: {
          provider: 'metorial-shuttle',
          backend: 'mcp.remote',
          triggers: { status: 'disabled' },
          auth: { status: 'disabled' },
          config: { status: 'disabled' }
        }
      }
    });

    let providerWithVariant = await db.provider.findFirstOrThrow({
      where: { oid: provider.oid },
      include: { defaultVariant: true }
    });

    if (!providerWithVariant.defaultVariant) {
      throw new Error('Provider default variant missing');
    }

    let providerVersion = await providerVersionInternalService.upsertVersion({
      variant: providerWithVariant.defaultVariant,
      isCurrent: true,
      source: {
        type: 'shuttle',
        shuttleServer,
        shuttleServerVersion,
        backend
      },
      info: {
        name: version.id
      },
      type: {
        name: 'MCP',
        attributes: {
          provider: 'metorial-shuttle',
          backend: 'mcp.remote',
          triggers: { status: 'disabled' },
          auth: { status: 'disabled' },
          config: { status: 'disabled' }
        }
      }
    });

    let preliminarySpecification = await discoverVersionSpecification({
      tenant,
      provider: providerWithVariant,
      providerVersion,
      providerVariant: providerWithVariant.defaultVariant
    });

    providerVersion = await db.providerVersion.update({
      where: { oid: providerVersion.oid },
      data: {
        specificationOid: preliminarySpecification.oid,
        specificationDiscoveryStatus: 'discovered'
      }
    });

    let providerDeployment = await providerDeploymentService.createProviderDeployment({
      tenant,
      solution,
      environment,
      provider: providerWithVariant,
      lockedVersion: providerVersion,
      input: {
        name: `Deployment ${generateCode(4)}`,
        description: 'Fixture deployment',
        config: {
          type: 'inline',
          data: {}
        }
      }
    });

    let providerConfig = await db.providerConfig.findFirstOrThrow({
      where: { oid: providerDeployment.defaultConfigOid! },
      include: { currentVersion: true }
    });

    if (!providerDeployment.currentVersion) {
      throw new Error('Provider deployment version missing');
    }
    if (!providerConfig.currentVersion) {
      throw new Error('Provider config version missing');
    }

    let pairRes = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      deployment: providerDeployment,
      config: providerConfig,
      authConfig: null,
      version: providerVersion
    });
    if (!pairRes.version) {
      throw new Error('Provider deployment config pair version missing');
    }

    let pairVersion = await waitForPairVersionDiscovery(db, pairRes.version.oid);

    let discoveredSpecification =
      pairVersion.specificationDiscoveryStatus === 'discovered' && pairVersion.specificationOid
        ? await db.providerSpecification.findFirstOrThrow({
            where: { oid: pairVersion.specificationOid }
          })
        : null;

    let specification: ProviderSpecification;
    if (discoveredSpecification?.type === 'full') {
      specification = discoveredSpecification;
    } else {
      specification = preliminarySpecification;

      try {
        let fullSpecification = await discoverPairSpecification({
          tenant,
          provider: providerWithVariant,
          providerVersion,
          providerVariant: providerWithVariant.defaultVariant,
          deploymentVersion: providerDeployment.currentVersion,
          configVersion: providerConfig.currentVersion,
          authConfigVersion: null
        });

        specification = fullSpecification;

        providerVersion = await db.providerVersion.update({
          where: { oid: providerVersion.oid },
          data: {
            specificationOid: specification.oid,
            specificationDiscoveryStatus: 'discovered'
          }
        });

        pairVersion = await db.providerDeploymentConfigPairProviderVersion.update({
          where: { oid: pairVersion.oid },
          data: {
            specificationDiscoveryStatus: 'discovered',
            specificationOid: specification.oid
          }
        });
      } catch (err) {
        console.warn(
          `Skipping full pair discovery for test fixture after timeout/failure: ${
            (err as Error)?.message ?? String(err)
          }`
        );
      }
    }

    if (pairRes.pair.lastUsedPairVersionOid !== pairVersion.oid) {
      await db.providerDeploymentConfigPair.update({
        where: { oid: pairRes.pair.oid },
        data: { lastUsedPairVersionOid: pairVersion.oid }
      });
    }

    providerVersion = await db.providerVersion.findFirstOrThrow({
      where: { oid: providerVersion.oid }
    });

    return {
      solution,
      tenant,
      environment,
      backend,
      shuttleServer,
      shuttleServerVersion,
      provider: providerWithVariant,
      providerVersion,
      specification,
      providerDeployment,
      providerConfig
    };
  };

  return {
    complete
  };
};
