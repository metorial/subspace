export type ConnectionError =
  | {
      code: 'tool_not_found';
      message: string;
    }
  | {
      code: 'invalid_request';
      message: string;
    };

export let toolNotFound = (toolId: string): ConnectionError => ({
  code: 'tool_not_found',
  message: `Tool with ID ${toolId} not found`
});

export let invalidRequest = (message: string): ConnectionError => ({
  code: 'invalid_request',
  message
});
