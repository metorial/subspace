import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, getId, ProviderAuthConfig, Solution, Tenant } from '@metorial-subspace/db';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { providerAuthConfigInclude } from './providerAuthConfig';

let include = {
  authConfig: {
    include: providerAuthConfigInclude
  }
};

class providerAuthExportServiceImpl {
  async listProviderAuthExports(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthExport.findMany({
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

  async getProviderAuthExportById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthExportId: string;
  }) {
    let providerAuthExport = await db.providerAuthExport.findFirst({
      where: {
        id: d.providerAuthExportId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthExport)
      throw new ServiceError(notFoundError('provider.auth_export', d.providerAuthExportId));

    return providerAuthExport;
  }

  async createProviderAuthExport(d: {
    tenant: Tenant;
    solution: Solution;
    authConfig: ProviderAuthConfig;

    input: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.authConfig);

    let backend = await getBackend({ entity: d.authConfig });

    let newId = getId('providerAuthExport');

    let data = await backend.auth.getDecryptedAuthConfig({
      tenant: d.tenant,
      authConfig: d.authConfig,
      note: `SUBSPACE/export ${d.input.ip}`
    });

    let authExport = await db.providerAuthExport.create({
      data: {
        ...newId,

        ip: d.input.ip,
        ua: d.input.ua,
        note: d.input.note,
        metadata: d.input.metadata,

        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        authConfigOid: d.authConfig.oid,

        expiresAt: data.expiresAt
      },
      include
    });

    return {
      authExport,
      decryptedConfigData: data.decryptedConfigData
    };
  }
}

export let providerAuthExportService = Service.create(
  'providerAuthExport',
  () => new providerAuthExportServiceImpl()
).build();
