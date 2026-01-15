export type ConnectionError = {
  code: 'tool_not_found';
  message: string;
};

export let toolNotFound = (toolId: string): ConnectionError => ({
  code: 'tool_not_found',
  message: `Tool with ID ${toolId} not found`
});
