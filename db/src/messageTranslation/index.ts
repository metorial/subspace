import { messageOutputToMcpBasic, translateMessageToMcp } from './translateToMcp';

export let messageTranslator = {
  toMcp: translateMessageToMcp,
  outputToMcpBasic: messageOutputToMcpBasic
};
