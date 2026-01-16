import type { JSONRPCErrorResponse } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export let mcpValidate = <S extends z.ZodSchema>(
  id: string | number | null | undefined,
  schema: S,
  data: any
) => {
  let res = schema.safeParse(data);
  if (!res.success) {
    return {
      success: false as const,
      error: {
        jsonrpc: '2.0',
        id: id ?? undefined,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: res.error
        }
      } satisfies JSONRPCErrorResponse
    };
  }

  return {
    success: true as const,
    data: res.data
  };
};
