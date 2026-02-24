import { notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { db, type EnvironmentType, getId } from '@metorial-subspace/db';

let include = {};

class tenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      environments: {
        name: string;
        identifier: string;
        type: EnvironmentType;
      }[];
    };
  }) {
    try {
      return await db.tenant.upsert({
        where: { identifier: d.input.identifier },
        update: {
          name: d.input.name,
          environments: {
            upsert: d.input.environments.map(env => ({
              where: { identifier: env.identifier },
              update: { name: env.name },
              create: {
                ...getId('environment'),
                name: env.name,
                identifier: env.identifier,
                type: env.type
              }
            }))
          }
        },
        create: {
          ...getId('tenant'),
          name: d.input.name,
          identifier: d.input.identifier,

          urlKey: generatePlainId(10).toLowerCase(),

          environments: {
            create: d.input.environments.map(env => ({
              ...getId('environment'),
              name: env.name,
              identifier: env.identifier,
              type: env.type
            }))
          }
        },
        include
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return await db.tenant.findFirstOrThrow({
          where: { identifier: d.input.identifier },
          include
        });
      }

      throw error;
    }
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return tenant;
  }

  async getTenantAndEnvironmentById(d: { tenantId: string; environmentId: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
      include: {
        environments: {
          where: { OR: [{ id: d.environmentId }, { identifier: d.environmentId }] }
        }
      }
    });
    let environment = tenant?.environments[0];

    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    if (!environment) throw new ServiceError(notFoundError('environment'));

    return {
      tenant,
      environment
    };
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new tenantServiceImpl()
).build();
