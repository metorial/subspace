import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  Identity,
  type IdentityCredential,
  type IdentityCredentialStatus,
  IdentityDelegationConfig,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  ProviderCombinationInput,
  providerCombinationService
} from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  identityCredentialCreatedQueue,
  identityCredentialDeletedQueue
} from '../queues/lifecycle/identityCredential';

export type IdentityCredentialInput = ProviderCombinationInput & {
  delegationConfigId?: string;
};

let include = {
  identity: true,
  delegationConfig: true
};

class identityCredentialServiceImpl {
  async listIdentityCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: IdentityCredentialStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
  }) {
    let agents = await resolveProviders(d, d.agentIds);
    let actors = await resolveProviders(d, d.actorIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityCredential.findMany({
            ...opts,
            where: {
              identity: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid,

                ...normalizeStatusForList(d).hasParent
              },

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,

                agents ? { identity: { actor: { agent: agents.oidIn } } } : undefined!,
                actors ? { identity: { actor: actors.oidIn } } : undefined!,

                providers ? { currentVersion: { providerOid: providers.in } } : undefined!,
                deployments
                  ? { currentVersion: { deploymentOid: deployments.in } }
                  : undefined!,
                configs ? { currentVersion: { configOid: configs.in } } : undefined!,
                authConfigs
                  ? { currentVersion: { authConfigOid: authConfigs.in } }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityCredentialById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredentialId: string;
    allowDeleted?: boolean;
  }) {
    let identityCredential = await db.identityCredential.findFirst({
      where: {
        id: d.identityCredentialId,

        ...normalizeStatusForGet(d).noParent,

        identity: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          ...normalizeStatusForGet(d).hasParent
        }
      },
      include
    });
    if (!identityCredential)
      throw new ServiceError(notFoundError('identity.credential', d.identityCredentialId));

    return identityCredential;
  }

  async internalCreateIdentityCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    identity: Identity;
    inputs: IdentityCredentialInput[];
  }) {
    return withTransaction(async db => {
      let delegationConfigIds = d.inputs.map(i => i.delegationConfigId!).filter(Boolean);

      let delegationConfigs = delegationConfigIds.length
        ? await db.identityDelegationConfig.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              id: { in: delegationConfigIds }
            }
          })
        : [];

      for (let delegationConfig of delegationConfigs) {
        checkTenant(d, delegationConfig);
        checkDeletedRelation(delegationConfig);
      }

      let delegationConfigMap = new Map(delegationConfigs.map(c => [c.id, c]));

      let combination = await providerCombinationService.getCombinations({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        providers: d.inputs
      });

      return await db.identityCredential.createManyAndReturn({
        data: combination.map((c, i) => {
          let input = d.inputs[i];

          let delegationConfig = input.delegationConfigId
            ? delegationConfigMap.get(input.delegationConfigId)
            : null;

          return {
            ...getId('identityCredential'),

            status: 'active',

            identityOid: d.identity.oid,

            authConfigOid: c.authConfig?.oid,
            configOid: c.config.oid,
            deploymentOid: c.deployment.oid,
            providerOid: c.provider.oid,

            delegationConfigOid: delegationConfig?.oid
          };
        }),
        include
      });
    });
  }

  async createIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    identity: Identity;

    input: IdentityCredentialInput;
  }) {
    checkTenant(d, d.identity);
    checkDeletedRelation(d.identity);

    return withTransaction(async db => {
      let [identityCredential] = await this.internalCreateIdentityCredentials({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        identity: d.identity,
        inputs: [d.input]
      });

      await addAfterTransactionHook(async () =>
        identityCredentialCreatedQueue.add({ identityCredentialId: identityCredential.id })
      );

      return identityCredential;
    });
  }

  async updateIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredential: IdentityCredential & { identity: Identity };

    input: {
      delegationConfig: IdentityDelegationConfig;
    };
  }) {
    checkTenant(d, d.identityCredential.identity);
    checkDeletedEdit(d.identityCredential, 'update');
    checkDeletedEdit(d.identityCredential.identity, 'update');

    return withTransaction(async db => {
      let identityCredential = await db.identityCredential.update({
        where: {
          oid: d.identityCredential.oid
        },
        data: {
          delegationConfigOid: d.input.delegationConfig.oid
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityCredentialDeletedQueue.add({ identityCredentialId: identityCredential.id })
      );

      return identityCredential;
    });
  }

  async archiveIdentityCredential(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityCredential: IdentityCredential & { identity: Identity };
  }) {
    checkTenant(d, d.identityCredential.identity);
    checkDeletedEdit(d.identityCredential, 'archive');
    checkDeletedEdit(d.identityCredential.identity, 'archive');

    return withTransaction(async db => {
      let identityCredential = await db.identityCredential.update({
        where: {
          oid: d.identityCredential.oid
        },
        data: {
          status: 'archived'
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityCredentialDeletedQueue.add({ identityCredentialId: identityCredential.id })
      );

      return identityCredential;
    });
  }
}

export let identityCredentialService = Service.create(
  'identityCredential',
  () => new identityCredentialServiceImpl()
).build();
