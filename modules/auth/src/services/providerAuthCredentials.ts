import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  Provider,
  ProviderAuthCredentials,
  ProviderVariant,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import {
  providerAuthCredentialsCreatedQueue,
  providerAuthCredentialsUpdatedQueue
} from '../queues/lifecycle/providerAuthCredentials';

let include = {
  provider: true
};

class providerAuthCredentialsServiceImpl {
  async listProviderAuthCredentials(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthCredentials.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              isEphemeral: false
            },
            include
          })
      )
    );
  }

  async getProviderAuthCredentialsById(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthCredentialsId: string;
  }) {
    let providerAuthCredentials = await db.providerAuthCredentials.findFirst({
      where: {
        id: d.providerAuthCredentialsId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid
      },
      include
    });
    if (!providerAuthCredentials)
      throw new ServiceError(notFoundError('provider.config', d.providerAuthCredentialsId));

    return providerAuthCredentials;
  }

  async createProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;

      config: {
        type: 'oauth';
        clientId: string;
        clientSecret: string;
        scopes: string[];
      };
    };
  }) {
    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({
        entity: d.provider.defaultVariant!
      });

      let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
        tenant: d.tenant,
        provider: d.provider,
        input: d.input.config
      });

      let providerAuthCredentials = await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),

          type: backendProviderAuthCredentials.type,

          backendOid: backend.backend.oid,

          slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials.oid,

          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          providerOid: d.provider.oid
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsCreatedQueue.add({
          providerAuthCredentialsId: providerAuthCredentials.id
        })
      );

      return providerAuthCredentials;
    });
  }

  async updateProviderAuthCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    providerAuthCredentials: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let config = await db.providerAuthCredentials.update({
        where: {
          oid: d.providerAuthCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerAuthCredentials.name,
          description: d.input.description ?? d.providerAuthCredentials.description,
          metadata: d.input.metadata ?? d.providerAuthCredentials.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthCredentialsUpdatedQueue.add({ providerAuthCredentialsId: config.id })
      );

      return config;
    });
  }
}

export let providerAuthCredentialsService = Service.create(
  'providerAuthCredentials',
  () => new providerAuthCredentialsServiceImpl()
).build();
