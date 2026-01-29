import { snowflake, withTransaction } from '@metorial-subspace/db';
import {
  IProviderDeployment,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes
} from '@metorial-subspace/provider-utils';
import { getTenantForShuttle, shuttle } from '../client';

export class ProviderDeployment extends IProviderDeployment {
  override async createProviderDeployment(
    _data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes> {
    return {};
  }

  override async createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes> {
    return withTransaction(async db => {
      if (!data.providerVariant.shuttleServerOid) {
        throw new Error('Provider variant does not have a shuttleServer associated with it');
      }

      let shuttleServer = await db.shuttleServer.findUniqueOrThrow({
        where: { oid: data.providerVariant.shuttleServerOid }
      });

      let tenant = await getTenantForShuttle(data.tenant);
      let res = await shuttle.serverConfig.create({
        tenantId: tenant.id,
        serverId: shuttleServer.id,
        config: data.config
      });

      let shuttleServerConfig = await db.shuttleServerConfig.create({
        data: {
          oid: snowflake.nextId(),
          id: res.id,

          shuttleServerOid: shuttleServer.oid,
          tenantOid: data.tenant.oid
        }
      });

      return { shuttleServerConfig };
    });
  }
}
