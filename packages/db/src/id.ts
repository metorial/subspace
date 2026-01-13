import { createIdGenerator, idType } from '@lowerdeck/id';
import { Worker as SnowflakeId } from 'snowflake-uuid';

export let ID = createIdGenerator({
  tenant: idType.sorted('ktn'),
  solution: idType.sorted('kso'),
  backend: idType.sorted('kbe'),

  publisher: idType.sorted('pub'),

  providerVariant: idType.sorted('pvr'),
  provider: idType.sorted('pro'),
  providerEntry: idType.sorted('pre'),
  providerVersion: idType.sorted('prv'),

  providerListing: idType.sorted('plg'),
  providerListingUpdate: idType.sorted('plu'),
  providerCategory: idType.sorted('pca'),
  providerCollection: idType.sorted('pco'),
  providerGroup: idType.sorted('pgr'),

  tenantProvider: idType.sorted('ktp'),

  providerDeployment: idType.sorted('pde'),
  providerConfig: idType.sorted('pcf'),
  providerConfigVault: idType.sorted('pcv'),
  providerDeploymentConfigPair: idType.sorted('pdcp'),
  providerDeploymentConfigPairProviderVersion: idType.sorted('pdcpv'),

  providerVersionSpecificationChange: idType.sorted('pvsc'),
  providerSpecificationChangeNotification: idType.sorted('pscn'),
  providerDeploymentConfigPairSpecificationChange: idType.sorted('pdcpsc'),

  providerTag: idType.sorted('kpt'),

  providerSpecification: idType.sorted('psp'),
  providerTool: idType.sorted('pto'),
  providerToolGlobal: idType.sorted('ptog'),
  providerAuthMethod: idType.sorted('pam'),
  providerAuthMethodGlobal: idType.sorted('pamg'),

  providerAuthCredentials: idType.sorted('pac'),
  providerAuthConfig: idType.sorted('pacf'),
  providerOAuthSetup: idType.sorted('poas'),
  providerOAuthSetup_clientSecret: idType.key('poas_secret'),
  providerAuthConfigUpdate: idType.sorted('pacu'),
  providerAuthSession: idType.sorted('pas'),
  providerAuthSession_clientSecret: idType.key('pas_secret'),
  providerAuthSessionEvent: idType.sorted('pase'),

  providerAuthImport: idType.sorted('paci'),
  providerAuthExport: idType.sorted('pace'),

  providerAuthConfigUsedForConfig: idType.sorted('pacufc'),
  providerAuthConfigUsedForDeployment: idType.sorted('pacufd')
});

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;

let workerId = (() => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0]! & workerIdMask;
})();

export let snowflake = new SnowflakeId(workerId, 0, {
  workerIdBits: workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z').getTime()
});

export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  oid: snowflake.nextId(),
  id: ID.generateIdSync(model)
});
