import { apiMux } from '@lowerdeck/api-mux';
import { createServer, rpcMux, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
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
import { providerSetupSessionController } from './providerSetupSession';
import { providerSpecificationController } from './providerSpecification';
import { providerToolController } from './providerTool';
import { providerVariantController } from './providerVariant';
import { providerVersionController } from './providerVersion';
import { publisherController } from './publisher';
import { solutionController } from './solution';
import { tenantController } from './tenant';

export let rootController = app.controller({
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
  publisher: publisherController,
  solution: solutionController,
  tenant: tenantController
});

export let subspaceControllerRPC = createServer({})(rootController);
export let subspaceControllerApi = apiMux([
  { endpoint: rpcMux({ path: '/subspace-controller' }, [subspaceControllerRPC]) }
]);

export type SubspaceControllerClient = InferClient<typeof rootController>;
