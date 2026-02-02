import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { type ActorType, db, getId, type Tenant } from '@metorial-subspace/db';

let include = {};

class actorServiceImpl {
  async upsertActor(d: {
    tenant: Tenant;
    input: {
      name: string;
      identifier: string;
      type: ActorType;
      organizationActorId?: string;
    };
  }) {
    return await db.actor.upsert({
      where: { identifier: d.input.identifier },
      update: { name: d.input.name },
      create: {
        ...getId('actor'),
        name: d.input.name,
        identifier: d.input.identifier,
        type: d.input.type,
        tenantOid: d.tenant.oid,
        organizationActorId: d.input.organizationActorId
      },
      include
    });
  }

  async getActorById(d: { tenant: Tenant; id: string }) {
    let actor = await db.actor.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        OR: [{ id: d.id }, { identifier: d.id }]
      },
      include
    });
    if (!actor) throw new ServiceError(notFoundError('actor'));
    return actor;
  }

  async getSystemActor(d: { tenant: Tenant }) {
    return this.upsertActor({
      tenant: d.tenant,
      input: {
        name: 'System',
        identifier: `system::${d.tenant.identifier}`,
        type: 'system'
      }
    });
  }
}

export let actorService = Service.create('actorService', () => new actorServiceImpl()).build();
