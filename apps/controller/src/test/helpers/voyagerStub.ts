import { createFetchRouter } from '@lowerdeck/testing-tools';
import { serialize } from '@lowerdeck/serialize';

type StubState = { counter: number };
type RpcCall = { id: string; name: string; payload: any };

const STUB_STATE_KEY = '__voyagerStubState';
const ROUTER_KEY = '__voyagerFetchRouter';

let rpcHandlers: Record<string, (payload: any, state: StubState) => any> = {
  'source:upsert': (p, s) => ({
    object: 'voyager.source',
    id: `src_${++s.counter}`,
    identifier: p?.identifier ?? 'default',
    name: p?.name ?? 'Default'
  }),
  'index:upsert': (p, s) => ({
    object: 'voyager.index',
    id: `idx_${++s.counter}`,
    identifier: p?.identifier ?? 'default',
    name: p?.name ?? 'Default',
    sourceId: p?.sourceId ?? 'src_1'
  }),
  'record:search': () => [],
  'record:index': (p, s) => ({
    object: 'voyager.record',
    id: `rec_${++s.counter}`,
    documentId: p?.documentId ?? 'doc',
    fields: p?.fields ?? {},
    body: p?.body ?? {},
    metadata: p?.metadata ?? {},
    hash: 'stub',
    isTenantSpecific: Array.isArray(p?.tenantIds) && p.tenantIds.length > 0,
    createdAt: new Date().toISOString()
  }),
  'record:delete': () => ({ success: true })
};

function getOrCreateRouter(): ReturnType<typeof createFetchRouter> {
  let existing = (globalThis as any)[ROUTER_KEY];
  if (existing) return existing;

  let router = createFetchRouter();
  router.install();
  (globalThis as any)[ROUTER_KEY] = router;
  return router;
}

export function setupVoyagerStub() {
  let endpoint = process.env.VOYAGER_URL;
  if (!endpoint) return;

  if ((globalThis as any)[STUB_STATE_KEY]) return;

  let state: StubState = { counter: 0 };
  (globalThis as any)[STUB_STATE_KEY] = state;

  let router = getOrCreateRouter();

  router.registerRoute(endpoint, async request => {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let text = await request.text();
    let body = serialize.decode(text ? JSON.parse(text) : {}) as {
      calls?: RpcCall[];
    };

    let results: Array<{ __typename: string; id: string; name: string; status: number; result: any }> = [];

    for (let call of body.calls ?? []) {
      let handler = rpcHandlers[call.name];
      if (!handler) {
        return new Response(
          JSON.stringify({ error: `Voyager test stub: unsupported RPC "${call.name}"` }),
          { status: 501, headers: { 'content-type': 'application/json' } }
        );
      }

      results.push({
        __typename: 'rpc.response.call',
        id: call.id,
        name: call.name,
        status: 200,
        result: handler(call.payload, state)
      });
    }

    return new Response(
      JSON.stringify({ __typename: 'rpc.response', calls: results }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  });
}

export function resetVoyagerStub() {
  let state = (globalThis as any)[STUB_STATE_KEY] as StubState | undefined;
  if (state) state.counter = 0;
}
