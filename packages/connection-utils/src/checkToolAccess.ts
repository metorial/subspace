import type { ProviderTool, SessionProvider } from '@metorial-subspace/db';

export let checkToolAccess = (
  tool: ProviderTool,
  provider: SessionProvider,
  _operation: 'list' | 'call'
) => {
  if (provider.toolFilter.type === 'v1.allow_all') return { allowed: true };

  if (provider.toolFilter.type === 'v1.whitelist') {
    for (let filter of provider.toolFilter.filters) {
      if (
        filter.type === 'tool_keys' &&
        (filter.keys.includes(tool.key) || filter.keys.includes(tool.id))
      ) {
        return { allowed: true };
      }
    }
  }

  return { allowed: false };
};
