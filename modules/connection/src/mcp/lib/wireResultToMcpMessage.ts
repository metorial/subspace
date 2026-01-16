import { messageOutputToMcp } from '@metorial-subspace/db';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { WireResult } from '../../types/wireMessage';

export let wireResultToMcpMessage = async (
  msg: WireResult
): Promise<JSONRPCMessage | null> => {
  let output = msg.output ?? msg.message?.output;
  if (!output) return null;

  return messageOutputToMcp(output, msg.message);
};
