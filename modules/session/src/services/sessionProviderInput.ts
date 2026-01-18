import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  getId,
  Provider,
  ProviderVariant,
  ProviderVersion,
  Session,
  SessionTemplate,
  Solution,
  Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import {
  providerConfigService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { sessionProviderInclude } from './sessionProvider';
import { sessionTemplateProviderInclude } from './sessionTemplateProvider';

export type SessionProviderInputToolFilters = { toolKeys?: string[] } | null;

export type SessionProviderInput = {
  sessionTemplateId?: string;

  deploymentId?: string;
  configId?: string;
  authConfigId?: string;

  toolFilters?: SessionProviderInputToolFilters;
};

let providerMismatchError = badRequestError({
  message: 'Provider session inputs have mismatched providers'
});

let deploymentMismatchError = badRequestError({
  message: 'Provider session inputs cannot be used with the selected deployment'
});

let checkProviderMatch = (
  a: { providerOid: bigint } | null,
  b: { providerOid: bigint } | null
) => {
  if (a && b && a.providerOid !== b.providerOid) throw new ServiceError(providerMismatchError);
};

class sessionProviderInputServiceImpl {
  async createProviderSessionInput(d: {
    tenant: Tenant;
    solution: Solution;

    providers: SessionProviderInput[];

    allowEphemeral?: boolean;
  }) {
    return withTransaction(
      async db => {
        let ts = {
          solutionOid: d.solution.oid,
          tenantOid: d.tenant.oid
        };

        for (let s of d.providers) {
          if (!s.sessionTemplateId && !s.configId && !s.deploymentId && !s.authConfigId) {
            throw new ServiceError(
              badRequestError({
                message:
                  'Please provide at least a provider config, auth config, or deployment'
              })
            );
          }
        }

        let normalizedProviders = (
          await Promise.all(
            d.providers.map(async s => {
              if (s.sessionTemplateId) {
                let template = await db.sessionTemplate.findFirstOrThrow({
                  where: { ...ts, id: s.sessionTemplateId },
                  include: {
                    providers: {
                      include: {
                        deployment: true,
                        config: true,
                        authConfig: true
                      }
                    }
                  }
                });

                return template.providers.map(tp => ({
                  deploymentId: tp.deployment.id,
                  configId: tp.config?.id,
                  authConfigId: tp.authConfig?.id,
                  toolFilters: s.toolFilters,
                  template,
                  templateProvider: tp
                }));
              }

              return {
                ...s,
                template: null,
                templateProvider: null
              };
            })
          )
        ).flat();

        if (normalizedProviders.length > 100) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot associate more than 100 providers to a session'
            })
          );
        }

        let res = await Promise.all(
          normalizedProviders.map(async s => {
            let config = s.configId
              ? await db.providerConfig.findFirst({ where: { ...ts, id: s.configId } })
              : null;
            let deployment = s.deploymentId
              ? await db.providerDeployment.findFirst({ where: { ...ts, id: s.deploymentId } })
              : null;
            let authConfig = s.authConfigId
              ? await db.providerAuthConfig.findFirst({ where: { ...ts, id: s.authConfigId } })
              : null;

            checkDeletedRelation(config, d);
            checkDeletedRelation(deployment, d);
            checkDeletedRelation(authConfig, d);

            let providerOid =
              config?.providerOid ?? authConfig?.providerOid ?? deployment?.providerOid;

            checkProviderMatch(config, deployment);
            checkProviderMatch(authConfig, deployment);
            checkProviderMatch(config, authConfig);

            let provider:
              | (Provider & {
                  defaultVariant:
                    | (ProviderVariant & { currentVersion: ProviderVersion | null })
                    | null;
                })
              | null = null;

            // Try to infer deployment from config or auth config
            if (!deployment) {
              let deploymentOid = config?.deploymentOid ?? authConfig?.deploymentOid;

              if (deploymentOid) {
                let fetchedDeployment = await db.providerDeployment.findFirstOrThrow({
                  where: { ...ts, oid: deploymentOid },
                  include: {
                    provider: {
                      include: { defaultVariant: { include: { currentVersion: true } } }
                    }
                  }
                });
                checkDeletedRelation(fetchedDeployment, d);

                provider = fetchedDeployment.provider;
                deployment = fetchedDeployment;
              }
            }

            // Get default deployment if still not set
            if (!provider && providerOid) {
              provider = await db.provider.findFirstOrThrow({
                where: { oid: providerOid },
                include: { defaultVariant: { include: { currentVersion: true } } }
              });
              checkDeletedRelation(provider, d);

              deployment = await providerDeploymentService.ensureDefaultProviderDeployment({
                tenant: d.tenant,
                solution: d.solution,
                provider
              });
            }

            if (!provider || !deployment) {
              throw new ServiceError(
                badRequestError({
                  message:
                    'Please provide at least a provider config, auth config, or deployment'
                })
              );
            }

            if (config?.deploymentOid && config.deploymentOid !== deployment.oid)
              throw new ServiceError(deploymentMismatchError);
            if (authConfig?.deploymentOid && authConfig.deploymentOid !== deployment.oid)
              throw new ServiceError(deploymentMismatchError);

            let version = await providerDeploymentInternalService.getCurrentVersion({
              deployment,
              provider
            });
            if (!version.specificationOid) {
              throw new ServiceError(badRequestError({ message: 'Provider cannot be run' }));
            }

            let spec = await db.providerSpecification.findFirstOrThrow({
              where: { oid: version.specificationOid }
            });

            if (!config) {
              if (deployment.defaultConfigOid) {
                config = await db.providerConfig.findFirstOrThrow({
                  where: { ...ts, oid: deployment.defaultConfigOid }
                });
                checkDeletedRelation(config, d);
              } else {
                let schema = spec.value.specification.configJsonSchema;
                let hasRequired = true;

                try {
                  if (schema.type == 'object' && schema.properties) {
                    let required = schema.required || [];
                    if (!required.length) hasRequired = false;
                  }
                } catch {}

                if (hasRequired) {
                  throw new ServiceError(
                    badRequestError({
                      message: 'Provider requires a config to be provided',
                      code: 'config_required'
                    })
                  );
                }

                config = await providerConfigService.ensureDefaultEmptyProviderConfig({
                  tenant: d.tenant,
                  solution: d.solution,
                  provider,
                  providerDeployment: deployment
                });
                checkDeletedRelation(config, d);
              }
            }

            if (!authConfig && spec.value.authMethods.length > 0) {
              if (deployment.defaultAuthConfigOid) {
                authConfig = await db.providerAuthConfig.findFirstOrThrow({
                  where: { ...ts, oid: deployment.defaultAuthConfigOid }
                });
                checkDeletedRelation(authConfig, d);
              } else {
                throw new ServiceError(
                  badRequestError({
                    message: 'Provider requires an auth config to be provided',
                    code: 'auth_config_required'
                  })
                );
              }
            }

            if (spec.value.authMethods.length > 0 && !authConfig) {
              throw new ServiceError(
                badRequestError({ message: 'Provider requires an auth config to be provided' })
              );
            }
            if (spec.value.authMethods.length == 0 && authConfig) {
              throw new ServiceError(
                badRequestError({ message: 'Provider does not support auth configs' })
              );
            }

            checkDeletedRelation(config, d);
            checkDeletedRelation(deployment, d);
            checkDeletedRelation(authConfig, d);

            return {
              deployment,
              provider,
              config,
              authConfig,
              template: s.template,
              templateProvider: s.templateProvider,
              toolFilters: s.toolFilters
            };
          })
        );

        return res;
      },
      { ifExists: true }
    );
  }

  async mapToolFilters(d: { filters: SessionProviderInputToolFilters | undefined }) {
    if (!d.filters) return { type: 'v1.allow_all' } satisfies PrismaJson.ToolFilter;

    return {
      type: 'v1.whitelist',
      filters: [
        {
          type: 'tool_keys',
          keys: d.filters.toolKeys || []
        }
      ]
    } satisfies PrismaJson.ToolFilter;
  }

  async createSessionProvidersForInput(d: {
    tenant: Tenant;
    solution: Solution;

    providers: SessionProviderInput[];
    session: Session;
  }) {
    let providerSessions = await this.createProviderSessionInput({
      tenant: d.tenant,
      solution: d.solution,
      providers: d.providers
    });

    return withTransaction(async db => {
      let existingProviderCount = await db.sessionProvider.count({
        where: {
          sessionOid: d.session.oid,
          status: 'active' as const
        }
      });
      if (providerSessions.length + existingProviderCount > 100) {
        throw new ServiceError(
          badRequestError({ message: 'Cannot associate more than 100 providers to a session' })
        );
      }

      return db.sessionProvider.createManyAndReturn({
        data: await Promise.all(
          providerSessions.map(async ps => ({
            ...getId('sessionProvider'),

            tag: generateCode(3),
            status: 'active' as const,
            isEphemeral: d.session.isEphemeral,

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,

            sessionOid: d.session.oid,
            providerOid: ps.provider.oid,
            deploymentOid: ps.deployment.oid,
            configOid: ps.config.oid,
            authConfigOid: ps.authConfig?.oid,

            fromTemplateOid: ps.template?.oid,
            fromTemplateProviderOid: ps.templateProvider?.oid,

            toolFilter: await this.mapToolFilters({ filters: ps.toolFilters })
          }))
        ),
        include: sessionProviderInclude
      });
    });
  }

  async createSessionTemplateProvidersForInput(d: {
    tenant: Tenant;
    solution: Solution;

    providers: SessionProviderInput[];
    template: SessionTemplate;
  }) {
    let providerSessions = await this.createProviderSessionInput({
      tenant: d.tenant,
      solution: d.solution,
      providers: d.providers
    });

    return withTransaction(async db => {
      let existingProviderCount = await db.sessionTemplateProvider.count({
        where: {
          sessionTemplateOid: d.template.oid,
          status: 'active' as const
        }
      });
      if (providerSessions.length + existingProviderCount > 100) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot associate more than 100 providers to a session template'
          })
        );
      }

      return db.sessionTemplateProvider.createManyAndReturn({
        data: await Promise.all(
          providerSessions.map(async ps => ({
            ...getId('sessionTemplateProvider'),

            tag: generateCode(3),
            status: 'active' as const,

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,

            sessionTemplateOid: d.template.oid,
            providerOid: ps.provider.oid,
            deploymentOid: ps.deployment.oid,
            configOid: ps.config.oid,
            authConfigOid: ps.authConfig?.oid,

            toolFilter: await this.mapToolFilters({ filters: ps.toolFilters })
          }))
        ),
        include: sessionTemplateProviderInclude
      });
    });
  }
}

export let sessionProviderInputService = Service.create(
  'sessionProviderInputService',
  () => new sessionProviderInputServiceImpl()
).build();
