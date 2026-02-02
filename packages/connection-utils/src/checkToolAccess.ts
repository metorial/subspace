import type { ProviderTool, SessionProvider } from '@metorial-subspace/db';
import safeRegex from 'safe-regex2';

let validateAndUseRegex = (pattern: string, flags?: string) => {
  if (!safeRegex(pattern)) {
    throw new Error('Potentially unsafe regex pattern detected');
  }
  return new RegExp(pattern, flags);
};

export let checkToolAccess = (
  tool: ProviderTool,
  provider: SessionProvider,
  _operation: 'list' | 'call'
) => {
  if (
    tool.value.mcpToolType.type == 'mcp.logging_setLevel' ||
    tool.value.mcpToolType.type == 'mcp.completion_complete'
  ) {
    return { allowed: false };
  }

  if (provider.toolFilter.type === 'v1.allow_all') return { allowed: true };

  if (provider.toolFilter.type === 'v1.filter') {
    for (let filter of provider.toolFilter.filters) {
      let mcpToolName: string | null = null;
      if (tool.value.mcpToolType.type == 'mcp.tool') mcpToolName = tool.value.mcpToolType.key;
      if (tool.value.mcpToolType.type == 'mcp.prompt')
        mcpToolName = tool.value.mcpToolType.key;

      switch (filter.type) {
        case 'tool_keys': {
          if (
            filter.keys.includes(tool.key) ||
            filter.keys.includes(tool.id) ||
            (mcpToolName && filter.keys.includes(mcpToolName))
          ) {
            return { allowed: true };
          }
          break;
        }

        case 'tool_regex': {
          let regex = validateAndUseRegex(filter.pattern, 'i');
          if (regex.test(tool.key) || regex.test(tool.id)) {
            return { allowed: true };
          }
          break;
        }

        case 'prompt_keys': {
          if (mcpToolName && filter.keys.includes(mcpToolName)) {
            return { allowed: true };
          }
          break;
        }

        case 'prompt_regex': {
          if (mcpToolName) {
            let regex = validateAndUseRegex(filter.pattern, 'i');
            if (regex.test(mcpToolName)) {
              return { allowed: true };
            }
          }
          break;
        }

        case 'resource_regex': {
          if (tool.value.mcpToolType.type === 'mcp.resource_template') {
            let regex = validateAndUseRegex(filter.pattern, 'i');
            if (regex.test(tool.value.mcpToolType.uriTemplate)) {
              return { allowed: true };
            }
          }
        }
      }
    }
  }

  return { allowed: false };
};

export let checkResourceAccessManager = (provider: SessionProvider) => {
  let regexCache = new Map<string, RegExp>();

  return (resourceUri: string) => {
    if (provider.toolFilter.type === 'v1.allow_all') return { allowed: true };

    if (provider.toolFilter.type === 'v1.filter') {
      for (let filter of provider.toolFilter.filters) {
        if (filter.type === 'resource_regex') {
          let regex = regexCache.get(filter.pattern);
          if (!regex) {
            regex = validateAndUseRegex(filter.pattern, 'i');
            regexCache.set(filter.pattern, regex);
          }

          if (regex.test(resourceUri)) {
            return { allowed: true };
          }
        }

        if (filter.type == 'resource_uris') {
          if (filter.uris.includes(resourceUri)) {
            return { allowed: true };
          }
        }
      }
    }

    return { allowed: false };
  };
};
