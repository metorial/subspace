import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  type Environment,
  getId,
  Identity,
  IdentityActor,
  IdentityDelegation,
  IdentityDelegationPartyRole,
  IdentityDelegationPermissions,
  IdentityDelegationRequest,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { DelegationChecker } from '../lib/delegationChecker';
import { FoldedMap } from '../lib/foldedMap';
import { isInPastOptional } from '../lib/isInPast';
import { delegationInclude } from './identityDelegation';
import { identityDelegationConfigService } from './identityDelegationConfig';

export interface CreateDelegationInput {
  identity: Identity;
  delegator?: IdentityActor;
  delegatee: IdentityActor;

  permissions?: IdentityDelegationPermissions[];
  expiresAt?: Date;

  delegationConfigId?: string;

  credentialOverrides?: {
    credentialId: string;
    permissions?: IdentityDelegationPermissions[];
    expiresAt?: Date;
  }[];

  note?: string;
  metadata?: Record<string, any>;
}

class identityDelegationInternalServiceImpl {
  async createDelegation(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    _internal:
      | { type: 'create_and_approve' }
      | { type: 'request'; requester: IdentityActor; expiresAt: Date };

    input: CreateDelegationInput;
  }) {
    checkTenant(d, d.input.identity);
    checkTenant(d, d.input.delegator);
    checkTenant(d, d.input.delegatee);

    checkDeletedRelation(d.input.identity);
    checkDeletedRelation(d.input.delegator);
    checkDeletedRelation(d.input.delegatee);

    if (d.input.delegatee.oid === d.input.delegator?.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Delegatee cannot be the same as delegator'
        })
      );
    }

    if (d.input.identity.actorOid === d.input.delegatee.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Delegatee cannot be the same as the owner identity'
        })
      );
    }

    // Make sure there are no delegations that don't do anything
    // (i.e. no permissions, no credential overrides with permissions)
    if (!d.input.permissions?.length) {
      let hasNestedPermissions = d.input.credentialOverrides?.some(o => o.permissions?.length);
      if (!hasNestedPermissions) {
        throw new ServiceError(
          badRequestError({
            message: 'At least one of delegation or credential permissions must be specified'
          })
        );
      }
    }

    if (isInPastOptional(d.input.expiresAt)) {
      throw new ServiceError(
        badRequestError({ message: 'Expiration date cannot be in the past' })
      );
    }
    for (let override of d.input.credentialOverrides ?? []) {
      if (isInPastOptional(override.expiresAt)) {
        throw new ServiceError(
          badRequestError({
            message: 'Credential override expiration date cannot be in the past'
          })
        );
      }
    }

    if (d._internal.type === 'request') {
      if (isInPastOptional(d._internal.expiresAt)) {
        throw new ServiceError(
          badRequestError({
            message: 'Request expiration date cannot be in the past'
          })
        );
      }

      if (
        d._internal.expiresAt &&
        d.input.expiresAt &&
        d._internal.expiresAt.getTime() !== d.input.expiresAt.getTime()
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'Request expiration date must be the same as delegation expiration date'
          })
        );
      }

      d.input.expiresAt = d._internal.expiresAt;
    }

    let configMap = d.input.delegationConfigId
      ? await this.resolveDelegationConfigs({
          ...d,
          configIds: [d.input.delegationConfigId]
        })
      : new Map<never, never>();
    let credentialMap = await this.resolveCredentials({
      ...d,
      identity: d.input.identity,
      credentialIds: d.input.credentialOverrides?.map(o => o.credentialId) || []
    });

    let subDelegator =
      !d.input.delegator || d.input.delegator.oid === d.input.identity.actorOid
        ? undefined
        : d.input.delegator;

    let overriddenDelegationConfig = d.input.delegationConfigId
      ? configMap.get(d.input.delegationConfigId)
      : undefined;
    let actualDelegationConfig =
      overriddenDelegationConfig ??
      (await identityDelegationConfigService.ensureDefaultIdentityDelegationConfig(d));

    let parties = await this.computeParties(d.input);

    return await withTransaction(async db => {
      let delegation = await db.identityDelegation.create({
        data: {
          ...getId('identityDelegation'),
          status: d._internal.type == 'request' ? 'waiting_for_consent' : 'active',

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,

          permissions: d.input.permissions,
          expiresAt: d.input.expiresAt,

          note: d.input.note,

          identityOid: d.input.identity.oid,
          subDelegatedFromOid: subDelegator?.oid,

          selectedDelegationConfigVersionOid: actualDelegationConfig.currentVersionOid!,

          delegationConfigOid: d.input.delegationConfigId
            ? configMap.get(d.input.delegationConfigId)!.oid
            : null
        }
      });

      await db.identityDelegationParty.createMany({
        data: parties.map(p => ({
          ...getId('identityDelegationParty'),
          delegationOid: delegation.oid,
          actorOid: p.actorOid,
          roles: p.roles
        }))
      });

      if (delegation.status !== 'active') {
        let checker = await DelegationChecker.create({
          ...d,
          identity: d.input.identity,
          actor: d.input.delegatee
        });

        let alreadyAllowed = await checker.checkMany({
          identityRequirements: {
            expiresAt: d.input.expiresAt ?? null,
            permissions: d.input.permissions ?? []
          },

          credentials:
            d.input.credentialOverrides?.map(o => ({
              credential: credentialMap.get(o.credentialId)!,
              requirements: {
                expiresAt: o.expiresAt ?? null,
                permissions: o.permissions ?? []
              }
            })) ?? []
        });

        if (alreadyAllowed) {
          let attestation = await db.identityDelegationAttestation.create({
            data: {
              ...getId('identityDelegationAttestation'),
              type: 'covered_by_previously_approved_delegation'
            }
          });

          delegation = await db.identityDelegation.update({
            where: { oid: delegation.oid },
            data: {
              status: 'active',
              attestationOid: attestation.oid
            }
          });
        }
      }

      if (d._internal.type == 'request') {
        await db.identityDelegationRequest.createMany({
          data: {
            ...getId('identityDelegationRequest'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            delegationOid: delegation.oid,
            requesterOid: d._internal.requester.oid,
            attestationOid: delegation.attestationOid,
            identityOid: d.input.identity.oid,

            expiresAt: d._internal.expiresAt,
            status: delegation.status === 'active' ? 'approved' : 'pending'
          }
        });
      }

      await db.identity.updateMany({
        where: { oid: d.input.identity.oid },
        data: { needsReconciliation: true }
      });

      return await db.identityDelegation.findUnique({
        where: { oid: delegation.oid },
        include: delegationInclude
      });
    });
  }

  async revokeIdentityDelegation(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegation: IdentityDelegation;
  }) {
    checkTenant(d, d.delegation);

    if (d.delegation.status !== 'active' && d.delegation.status !== 'waiting_for_consent') {
      throw new ServiceError(
        badRequestError({
          message: 'Only active or pending delegations can be revoked'
        })
      );
    }

    return await withTransaction(async db => {
      let delegation = await db.identityDelegation.update({
        where: { oid: d.delegation.oid },
        data: {
          status: 'revoked',
          revokedAt: new Date()
        },
        include: { request: true }
      });

      if (delegation.request?.status == 'pending') {
        await db.identityDelegationRequest.updateMany({
          where: { oid: delegation.request.oid },
          data: { status: 'canceled' }
        });
      }

      return await db.identityDelegation.findUnique({
        where: { oid: delegation.oid },
        include: delegationInclude
      });
    });
  }

  async alterIdentityDelegationRequest(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    delegationRequest: IdentityDelegationRequest;
    desiredStatus: 'approved' | 'denied';
  }) {
    checkTenant(d, d.delegationRequest);

    if (d.delegationRequest.status !== 'pending') {
      throw new ServiceError(
        badRequestError({
          message: 'Only pending delegation requests can be approved'
        })
      );
    }

    return await withTransaction(async db => {
      await db.identityDelegation.updateMany({
        where: { oid: d.delegationRequest.delegationOid },
        data: { status: d.desiredStatus === 'approved' ? 'active' : 'denied' }
      });

      await db.identityDelegationRequest.updateMany({
        where: { oid: d.delegationRequest.oid },
        data: { status: d.desiredStatus }
      });

      return await db.identityDelegation.findUnique({
        where: { oid: d.delegationRequest.delegationOid },
        include: delegationInclude
      });
    });
  }

  private async computeParties(d: {
    identity: Identity;
    delegator?: IdentityActor;
    delegatee: IdentityActor;
  }) {
    let ownerOid = d.identity.actorOid;
    let delegatorOid = d.delegator?.oid ?? ownerOid;
    let delegateeOid = d.delegatee.oid;

    let partiesMap = new FoldedMap<bigint, IdentityDelegationPartyRole>();
    partiesMap.put(ownerOid, 'owner');
    partiesMap.put(delegatorOid, 'delegator');
    partiesMap.put(delegateeOid, 'delegatee');

    return partiesMap.map((actorOid, roles) => ({ actorOid, roles }));
  }

  private async resolveDelegationConfigs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    configIds: string[];
  }) {
    return withTransaction(
      async db => {
        let configs = d.configIds.length
          ? await db.identityDelegationConfig.findMany({
              where: { id: { in: d.configIds } }
            })
          : [];
        for (let config of configs) {
          checkTenant(d, config);
          checkDeletedRelation(config);
        }

        let configMap = new Map(configs.map(c => [c.id, c]));
        for (let configId of d.configIds) {
          if (!configMap.has(configId)) {
            throw new ServiceError(notFoundError('identity.delegation_config', configId));
          }
        }

        return configMap;
      },
      { ifExists: true }
    );
  }

  private async resolveCredentials(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
    credentialIds: string[];
  }) {
    return withTransaction(
      async db => {
        let credentials = d.credentialIds.length
          ? await db.identityCredential.findMany({
              where: { id: { in: d.credentialIds } }
            })
          : [];
        for (let credential of credentials) {
          checkDeletedRelation(credential);
          if (credential.identityOid !== d.identity.oid) {
            throw new ServiceError(notFoundError('identity.credential', credential.id));
          }
        }

        let credentialMap = new Map(credentials.map(c => [c.id, c]));
        for (let credentialId of d.credentialIds) {
          if (!credentialMap.has(credentialId)) {
            throw new ServiceError(notFoundError('identity.credential', credentialId));
          }
        }

        return credentialMap;
      },
      { ifExists: true }
    );
  }
}

export let identityDelegationInternalService = Service.create(
  'identityDelegationInternal',
  () => new identityDelegationInternalServiceImpl()
).build();
