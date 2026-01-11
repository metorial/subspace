import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { db, getId, Provider, ProviderVersion } from '@metorial-subspace/db';
import {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool
} from '@metorial-subspace/provider-utils';

class providerSpecificationInternalServiceImpl {
  async ensureProviderSpecification(d: {
    provider: Provider;
    providerVersion: ProviderVersion;

    specification: Specification;
    authMethods: SpecificationAuthMethod[];
    features: SpecificationFeatures;
    tools: SpecificationTool[];
  }) {
    let specHash = await Hash.sha256(
      canonicalize({
        providerId: d.provider.id,
        specification: d.specification,
        authMethods: d.authMethods,
        features: d.features,
        tools: d.tools
      })
    );

    let existingSpec = await db.providerSpecification.findUnique({
      where: {
        providerOid_hash: {
          providerOid: d.provider.oid,
          hash: specHash
        }
      }
    });
    if (existingSpec) return existingSpec;

    return await db.providerSpecification.create({
      data: {
        ...getId('providerSpecification'),
        providerOid: d.provider.oid,

        hash: specHash,

        specId: d.specification.specId,
        specUniqueIdentifier: d.specification.specUniqueIdentifier,
        key: d.specification.key,

        name: d.specification.name,
        description: d.specification.description,

        value: {
          specification: d.specification,
          authMethods: d.authMethods,
          features: d.features,
          tools: d.tools
        },

        supportsAuthMethod: d.features.supportsAuthMethod,
        configContainsAuth: d.features.configContainsAuth,

        providerAuthMethods: {
          create: await Promise.all(
            d.authMethods.map(async am => ({
              ...getId('providerAuthMethod'),
              specId: am.specId,
              specUniqueIdentifier: am.specUniqueIdentifier,
              callableId: am.callableId,
              key: am.key,

              name: am.name,
              description: am.description,

              type: am.type,

              value: am,

              providerOid: d.provider.oid,
              hash: await Hash.sha256(canonicalize([d.provider.id, am]))
            }))
          )
        },

        providerTools: {
          create: await Promise.all(
            d.tools.map(async t => ({
              ...getId('providerTool'),
              specId: t.specId,
              specUniqueIdentifier: t.specUniqueIdentifier,
              callableId: t.callableId,
              key: t.key,

              name: t.name,
              description: t.description,

              value: t,

              providerOid: d.provider.oid,
              hash: await Hash.sha256(canonicalize([d.provider.id, t]))
            }))
          )
        }
      }
    });
  }
}

export let providerSpecificationInternalService = Service.create(
  'providerSpecificationInternalService',
  () => new providerSpecificationInternalServiceImpl()
).build();
