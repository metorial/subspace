import { apiMux } from '@lowerdeck/api-mux';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { actorController } from './actor';
import { containerRegistryController } from './containerRegistry';
import { containerRepositoryController } from './containerRepository';
import { customProviderController } from './customProvider';
import { customProviderCommitController } from './customProviderCommit';
import { customProviderDeploymentController } from './customProviderDeployment';
import { customProviderEnvironmentController } from './customProviderEnvironment';
import { customProviderVersionController } from './customProviderVersion';
import { environmentController } from './environment';
import { networkingRulesetController } from './networkingRuleset';
import { providerController } from './provider';
import { providerAuthConfigController } from './providerAuthConfig';
import { providerAuthCredentialsController } from './providerAuthCredentials';
import { providerAuthExportController } from './providerAuthExport';
import { providerAuthImportController } from './providerAuthImport';
import { providerAuthMethodController } from './providerAuthMethod';
import { providerListingCategoryController } from './providerCategory';
import { providerListingCollectionController } from './providerCollection';
import { providerConfigController } from './providerConfig';
import { providerConfigVaultController } from './providerConfigVault';
import { providerDeploymentController } from './providerDeployment';
import { providerListingGroupController } from './providerGroup';
import { providerListingController } from './providerListing';
import { providerOAuthSetupController } from './providerOAuthSetup';
import { providerRunController } from './providerRun';
import { providerSetupSessionController } from './providerSetupSession';
import { providerSpecificationController } from './providerSpecification';
import { providerToolController } from './providerTool';
import { providerVariantController } from './providerVariant';
import { providerVersionController } from './providerVersion';
import { publisherController } from './publisher';
import { scmConnectionController } from './scmConnection';
import { scmConnectionSetupSessionController } from './scmConnectionSetupSession';
import { scmProviderController } from './scmProvider';
import { scmProviderSetupSessionController } from './scmProviderSetupSession';
import { scmRepositoryController } from './scmRepository';
import { sessionController } from './session';
import { sessionConnectionController } from './sessionConnection';
import { sessionErrorController } from './sessionError';
import { sessionErrorGroupController } from './sessionErrorGlobal';
import { sessionMessageController } from './sessionMessage';
import { sessionParticipantController } from './sessionParticipant';
import { sessionProviderController } from './sessionProvider';
import { sessionTemplateController } from './sessionTemplate';
import { sessionTemplateProviderController } from './sessionTemplateProvider';
import { solutionController } from './solution';
import { tenantController } from './tenant';

export let rootController = app.controller({
  environment: environmentController,
  actor: actorController,
  solution: solutionController,
  tenant: tenantController,

  publisher: publisherController,

  provider: providerController,
  providerAuthConfig: providerAuthConfigController,
  providerAuthCredentials: providerAuthCredentialsController,
  providerAuthExport: providerAuthExportController,
  providerAuthImport: providerAuthImportController,
  providerAuthMethod: providerAuthMethodController,
  providerSetupSession: providerSetupSessionController,
  providerListingCategory: providerListingCategoryController,
  providerListingCollection: providerListingCollectionController,
  providerListingGroup: providerListingGroupController,
  providerConfig: providerConfigController,
  providerConfigVault: providerConfigVaultController,
  providerDeployment: providerDeploymentController,
  providerListing: providerListingController,
  providerOAuthSetup: providerOAuthSetupController,
  providerSpecification: providerSpecificationController,
  providerTool: providerToolController,
  providerVariant: providerVariantController,
  providerVersion: providerVersionController,

  session: sessionController,
  sessionProvider: sessionProviderController,
  sessionConnection: sessionConnectionController,
  sessionError: sessionErrorController,
  sessionErrorGroup: sessionErrorGroupController,
  sessionMessage: sessionMessageController,
  sessionParticipant: sessionParticipantController,
  sessionTemplate: sessionTemplateController,
  sessionTemplateProvider: sessionTemplateProviderController,

  customProvider: customProviderController,
  customProviderCommit: customProviderCommitController,
  customProviderDeployment: customProviderDeploymentController,
  customProviderVersion: customProviderVersionController,
  customProviderEnvironment: customProviderEnvironmentController,

  containerRegistry: containerRegistryController,
  containerRepository: containerRepositoryController,
  networkingRuleset: networkingRulesetController,

  providerRun: providerRunController,

  scmConnection: scmConnectionController,
  scmConnectionSetupSession: scmConnectionSetupSessionController,
  scmProvider: scmProviderController,
  scmProviderSetupSession: scmProviderSetupSessionController,
  scmRepository: scmRepositoryController
});

export let subspaceControllerRPC = createServer({})(rootController);
export let subspaceControllerApi = apiMux([
  { endpoint: rpcMux({ path: '/subspace-controller' }, [subspaceControllerRPC]) }
]);

export type SubspaceControllerClient = InferClient<typeof rootController>;
