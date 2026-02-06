import { setupPrismaTestDb, setupTestGlobals, createFetchRouter } from '@lowerdeck/testing-tools';
import { serialize } from '@lowerdeck/serialize';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@metorial-subspace/db';
import { sessionMessageBucketRecord } from '@metorial-subspace/connection-utils';
import { afterAll } from 'vitest';

setupTestGlobals({ nodeEnv: 'test' });

type VoyagerStubState = {
  reset: () => void;
};

const voyagerStubStateKey = '__subspaceVoyagerStubState';

const setupVoyagerStub = () => {
  const endpoint = process.env.VOYAGER_URL;
  if (!endpoint) return;

  let existing = (globalThis as any)[voyagerStubStateKey] as VoyagerStubState | undefined;
  if (existing) {
    return existing;
  }

  const key = '__subspaceVoyagerFetchRouter';
  let router = (globalThis as any)[key] as
    | ReturnType<typeof createFetchRouter>
    | undefined;

  if (!router) {
    router = createFetchRouter();
    router.install();
    (globalThis as any)[key] = router;
  }

  const sources = new Map<string, { id: string; identifier: string; name: string }>();
  const indexes = new Map<
    string,
    { id: string; identifier: string; name: string; sourceId: string }
  >();
  let recordCounter = 0;

  const reset = () => {
    sources.clear();
    indexes.clear();
    recordCounter = 0;
  };

  const ensureSource = (identifier: string, name: string) => {
    let existing = sources.get(identifier);
    if (existing) return existing;

    let source = {
      id: `src_${sources.size + 1}`,
      identifier,
      name
    };
    sources.set(identifier, source);
    return source;
  };

  const ensureIndex = (identifier: string, name: string, sourceId: string) => {
    let existing = indexes.get(identifier);
    if (existing) return existing;

    let index = {
      id: `idx_${indexes.size + 1}`,
      identifier,
      name,
      sourceId
    };
    indexes.set(identifier, index);
    return index;
  };

  router.registerRoute(endpoint, async request => {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let text = await request.text();
    let parsed = text ? JSON.parse(text) : {};
    let body = serialize.decode(parsed) as {
      calls?: { id: string; name: string; payload: any }[];
      requestId?: string;
    };

    let calls = body.calls ?? [];
    let results = calls.map(call => {
      let result: any = {};

      if (call.name === 'source:upsert') {
        let input = call.payload ?? {};
        let source = ensureSource(input.identifier ?? 'default', input.name ?? 'Default');
        result = { object: 'voyager.source', ...source };
      } else if (call.name === 'index:upsert') {
        let input = call.payload ?? {};
        let index = ensureIndex(
          input.identifier ?? 'default',
          input.name ?? 'Default',
          input.sourceId ?? 'src_1'
        );
        result = { object: 'voyager.index', ...index };
      } else if (call.name === 'record:search') {
        result = [];
      } else if (call.name === 'record:index') {
        let input = call.payload ?? {};
        result = {
          object: 'voyager.record',
          id: `rec_${++recordCounter}`,
          documentId: input.documentId ?? 'doc',
          fields: input.fields ?? {},
          body: input.body ?? {},
          metadata: input.metadata ?? {},
          hash: 'stub',
          isTenantSpecific: Array.isArray(input.tenantIds) && input.tenantIds.length > 0,
          createdAt: new Date().toISOString()
        };
      } else if (call.name === 'record:delete') {
        result = { success: true };
      }

      return {
        __typename: 'rpc.response.call',
        id: call.id,
        name: call.name,
        status: 200,
        result
      };
    });

    return new Response(
      JSON.stringify({
        __typename: 'rpc.response',
        calls: results
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  });

  let state = { reset } satisfies VoyagerStubState;
  (globalThis as any)[voyagerStubStateKey] = state;
  return state;
};

setupVoyagerStub();

const resetVoyagerStub = () => {
  let state = (globalThis as any)[voyagerStubStateKey] as VoyagerStubState | undefined;
  state?.reset();
};

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'subspace-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

const ensureSessionMessageBucket = async () => {
  await db.client.sessionMessageStorageBucket.upsert({
    where: { bucket: sessionMessageBucketRecord.bucket },
    update: {},
    create: {
      oid: sessionMessageBucketRecord.oid,
      bucket: sessionMessageBucketRecord.bucket
    }
  });
};

await ensureSessionMessageBucket();

export let testDb = db.client;
export let cleanDatabase = async () => {
  await db.clean();
  resetVoyagerStub();
  await ensureSessionMessageBucket();
};
