import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  Provider,
  ProviderAuthConfig,
  ProviderDeployment,
  ProviderVariant,
  ProviderVersion,
  Solution,
  Tenant
} from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { providerAuthConfigInclude, providerAuthConfigService } from './providerAuthConfig';

let include = {
  authConfig: {
    include: providerAuthConfigInclude
  }
};

class providerAuthImportServiceImpl {
  async listProviderAuthImports(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthImport.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid
            },
            include
          })
      )
    );
  }

  async getProviderAuthImportById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthImportId: string;
  }) {
    let providerAuthImport = await db.providerAuthImport.findFirst({
      where: {
        id: d.providerAuthImportId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthImport)
      throw new ServiceError(notFoundError('provider_config', d.providerAuthImportId));

    return providerAuthImport;
  }

  async createProviderAuthImport(d: {
    tenant: Tenant;
    solution: Solution;

    provider?: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      lockedVersion: ProviderVersion | null;
    };
    providerAuthConfig?: ProviderAuthConfig;

    input: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
      metadata?: Record<string, any>;

      authMethodId?: string;
      config: Record<string, any>;
    };
  }) {
    checkTenant(d, d.providerAuthConfig);

    if (
      d.providerDeployment &&
      d.provider &&
      d.providerDeployment.providerOid != d.provider.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not belong to provider',
          code: 'provider_mismatch'
        })
      );
    }
    if (
      d.providerAuthConfig?.deploymentOid &&
      d.providerDeployment &&
      d.providerAuthConfig.deploymentOid !== d.providerDeployment.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider deployment does not match between import and config',
          code: 'provider_mismatch'
        })
      );
    }

    let importOid: bigint;

    if (d.providerAuthConfig) {
      checkTenant(d, d.providerAuthConfig);

      if (d.provider && d.providerAuthConfig.providerOid !== d.provider.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider mismatch between import and config',
            code: 'provider_mismatch'
          })
        );
      }
      if (d.providerDeployment && !d.providerAuthConfig.deploymentOid) {
        throw new ServiceError(
          badRequestError({
            message:
              'Provider auth config is not associated with a deployment and can no longer be linked to one',
            code: 'provider_deployment_mismatch'
          })
        );
      }

      let authConfigRes = await providerAuthConfigService.updateProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        providerAuthConfig: d.providerAuthConfig,

        import: {
          ip: d.input.ip,
          ua: d.input.ua,
          note: d.input.note
        },

        input: {
          authMethodId: d.input.authMethodId,
          config: d.input.config
        }
      });

      importOid = authConfigRes.authImport!.oid;
    } else {
      if (!d.provider) {
        throw new ServiceError(
          badRequestError({
            message: 'Provider must be provided when no auth config is given',
            code: 'provider_required'
          })
        );
      }

      let authConfigRes = await providerAuthConfigService.createProviderAuthConfig({
        tenant: d.tenant,
        solution: d.solution,
        provider: d.provider,
        providerDeployment: d.providerDeployment,

        import: {
          ip: d.input.ip,
          ua: d.input.ua,
          note: d.input.note
        },

        input: {
          authMethodId: d.input.authMethodId,
          name: `Imported Config ${new Date().toISOString()}`,
          config: d.input.config,
          metadata: d.input.metadata
        }
      });

      importOid = authConfigRes.authImport!.oid;
    }

    return db.providerAuthImport.findUniqueOrThrow({
      where: { oid: importOid },
      include
    });
  }
}

export let providerAuthImportService = Service.create(
  'providerAuthImport',
  () => new providerAuthImportServiceImpl()
).build();
