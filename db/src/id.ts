import { createIdGenerator, idType } from '@lowerdeck/id';
import { Worker as SnowflakeId } from 'snowflake-uuid';

export let ID = createIdGenerator({
  tenant: idType.sorted('ktn'),
  solution: idType.sorted('kso'),
  environment: idType.sorted('ken'),
  backend: idType.sorted('kbe'),
  brand: idType.sorted('kbr'),
  actor: idType.sorted('kac'),

  publisher: idType.sorted('pub'),

  providerVariant: idType.sorted('pvr'),
  provider: idType.sorted('pro'),
  providerEntry: idType.sorted('pre'),
  providerVersion: idType.sorted('prv'),
  providerType: idType.sorted('pty'),

  providerListing: idType.sorted('plg'),
  providerListingUpdate: idType.sorted('plu'),
  providerCategory: idType.sorted('pca'),
  providerCollection: idType.sorted('pco'),
  providerGroup: idType.sorted('pgr'),

  environmentProvider: idType.sorted('kep'),

  providerEnvironment: idType.sorted('pen'),
  providerEnvironmentVersion: idType.sorted('pev'),

  providerDeployment: idType.sorted('pde'),
  providerDeploymentVersion: idType.sorted('pdv'),

  providerConfig: idType.sorted('pcf'),
  providerConfigVersion: idType.sorted('pcv'),
  providerConfigUpdate: idType.sorted('pcu'),
  providerConfigVault: idType.sorted('pcvt'),

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

  providerAuthCredentials: idType.sorted('par'),
  providerAuthConfig: idType.sorted('pac'),
  providerAuthConfigVersion: idType.sorted('pacv'),
  providerOAuthSetup: idType.sorted('poas'),
  providerOAuthSetup_clientSecret: idType.key('poas_secret'),
  providerAuthConfigUpdate: idType.sorted('pacu'),
  providerSetupSession: idType.sorted('pas'),
  providerSetupSession_clientSecret: idType.key('pas_secret'),
  providerSetupSessionEvent: idType.sorted('pase'),

  providerAuthImport: idType.sorted('paci'),
  providerAuthExport: idType.sorted('pace'),

  providerAuthConfigUsedForConfig: idType.sorted('pacufc'),
  providerAuthConfigUsedForDeployment: idType.sorted('pacufd'),

  customProvider: idType.sorted('cpr'),
  customProviderCommit: idType.sorted('cpc'),
  customProviderVersion: idType.sorted('cpv'),
  customProviderDeployment: idType.sorted('cpd'),
  customProviderEnvironment: idType.sorted('cpe'),
  customProviderEnvironmentVersion: idType.sorted('cpev'),

  session: idType.sorted('ses'),
  sessionTemplate: idType.sorted('set'),
  sessionTemplateProvider: idType.sorted('stp'),
  sessionProvider: idType.sorted('spv'),
  sessionProviderInstance: idType.sorted('spi'),
  sessionMessage: idType.sorted('smg'),
  sessionMessage_mcp: idType.sorted('smg_mcp'),
  sessionParticipant: idType.sorted('spar'),
  sessionEvent: idType.sorted('sev'),
  sessionClientConnection: idType.sorted('scc'),
  sessionConnection: idType.sorted('scon'),
  sessionConnection_token: idType.unsorted('scon_tok', 30),
  sessionError: idType.sorted('serr'),
  sessionErrorGroup: idType.sorted('serg'),

  providerRun: idType.sorted('prun'),

  toolCall: idType.sorted('tcl')
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

export let get4ByteIntId = (): number => {
  let buffer = new Int32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
};
