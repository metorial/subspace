import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

let startRankQueue = createQueue({
  name: 'sub/pint/rank/start',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1
  }
});

export let processSingleRankQueue = createQueue<{ providerListingId: string }>({
  name: 'sub/pint/rank/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 2,
    limiter: process.env.NODE_ENV === 'development' ? undefined : { max: 20, duration: 1000 }
  }
});

let rankCron = createCron(
  {
    name: 'sub/pint/rank/cron',
    cron: '0 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (process.env.NODE_ENV === 'development') return;
    await startRankQueue.add({}, { id: 'rank' });
  }
);

let startRankQueueProcessor = startRankQueue.process(async () => {
  let afterId: string | undefined;

  for (let i = 0; i < 10_000; i++) {
    let providers = await db.providerListing.findMany({
      where: {
        id: { gt: afterId }
      },
      select: { id: true },
      take: 100,
      orderBy: { id: 'asc' }
    });
    if (providers.length === 0) break;

    await processSingleRankQueue.addManyWithOps(
      providers.map(provider => ({
        data: { providerListingId: provider.id },
        opts: { id: provider.id }
      }))
    );

    afterId = providers[providers.length - 1]!.id as string;
  }
});

let processSingleRankQueueProcessor = processSingleRankQueue.process(async data => {
  let providerListing = await db.providerListing.findUnique({
    where: { id: data.providerListingId, isPublic: true },
    include: {
      publisher: true,
      provider: {
        include: {
          defaultVariant: true
        }
      }
    }
  });
  if (!providerListing) return;

  let rank = 0;
  let deploymentsCount = 0;
  let providerSessionsCount = 0;
  let providerMessagesCount = 0;

  let isVerified = providerListing.isVerified;
  let isMetorial = providerListing.isMetorial;
  let isSlates =
    providerListing.provider.access == 'public' &&
    !!providerListing.provider.defaultVariant?.slateOid;

  let isOfficial = providerListing.isOfficial;

  deploymentsCount = await db.providerDeployment.count({
    where: { providerOid: providerListing.providerOid }
  });
  providerSessionsCount = await db.sessionProvider.count({
    where: { providerOid: providerListing.providerOid }
  });

  let providerMessagesCountAgg = await db.sessionProvider.aggregate({
    where: { providerOid: providerListing.providerOid },
    _sum: {
      totalProductiveProviderMessageCount: true,
      totalProductiveClientMessageCount: true
    }
  });

  providerMessagesCount =
    (providerMessagesCountAgg._sum.totalProductiveProviderMessageCount ?? 0) +
    (providerMessagesCountAgg._sum.totalProductiveClientMessageCount ?? 0);

  // Calculate rank based on various factors
  rank = Math.ceil(
    deploymentsCount * 0.1 + providerSessionsCount * 0.3 + providerMessagesCount * 0.01
  );

  if (isSlates) rank += 10_000;

  // Boost rank for official/metorial providers
  if (isOfficial || isVerified) rank = Math.ceil(rank * 3);
  if (isMetorial) rank = 10_000 + Math.ceil(rank * 5);

  rank = Math.min(rank, 1_000_000_000);

  await db.providerListing.updateMany({
    where: { oid: providerListing.oid },
    data: {
      deploymentsCount,
      providerSessionsCount,
      providerMessagesCount,

      rank,
      rankUpdatedAt: new Date()
    }
  });
});

export let rankProcessors = combineQueueProcessors([
  rankCron,
  startRankQueueProcessor,
  processSingleRankQueueProcessor
]);
