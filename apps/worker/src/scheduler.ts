import { queues } from './lib/queue';
import { logger } from './lib/logger';

export async function scheduleJobs() {
  const removeRepeatables = async (queue: any, names: string[]) => {
    const jobs = await queue.getRepeatableJobs();
    for (const job of jobs) {
      if (names.includes(job.name)) {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`Removed repeatable job: ${job.name}`);
      }
    }
  };

  // Clean up old repeatable jobs that are now disabled
  await removeRepeatables(queues.ingestion, ['sync-markets']);
  
  // ✅ ALPHA MARKETS ENABLED - jobs will be scheduled below
  // (previously removed here, but now they stay active)

  // Sync leaderboard every 5 minutes
  await queues.ingestion.add(
    'sync-leaderboard',
    { type: 'sync-leaderboard' },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
    }
  );
  logger.info('Scheduled: sync-leaderboard (every 5 minutes)');

  // Sync markets every 10 minutes
  // TEMPORARILY DISABLED - focus on leaderboard + map only
  // await queues.ingestion.add(
  //   'sync-markets',
  //   { type: 'sync-markets' },
  //   {
  //     repeat: {
  //       pattern: '*/10 * * * *', // Every 10 minutes
  //       },
  //   }
  // );
  // logger.info('Scheduled: sync-markets (every 10 minutes)');

  // Calculate rarity scores every 30 minutes
  await queues.scoring.add(
    'calculate-rarity-scores',
    { type: 'calculate-rarity-scores' },
    {
      repeat: {
        pattern: '*/30 * * * *', // Every 30 minutes
      },
    }
  );
  logger.info('Scheduled: calculate-rarity-scores (every 30 minutes)');

  // === SMART MARKETS JOBS ===
  
  // Discover new smart markets every 30 minutes
  await queues.smartMarkets.add(
    'discover-new-markets',
    { type: 'discover-new-markets' },
    {
      repeat: {
        pattern: '*/30 * * * *', // Every 30 minutes
      },
    }
  );
  logger.info('Scheduled: discover-new-markets (every 30 minutes)');

  // Update pinned markets every 24 hours
  await queues.smartMarkets.add(
    'update-pinned-markets',
    { type: 'update-pinned-markets' },
    {
      repeat: {
        pattern: '0 */24 * * *', // Every 24 hours
      },
    }
  );
  logger.info('Scheduled: update-pinned-markets (every 24 hours)');

  // Refresh pinned selection every 6 hours
  await queues.smartMarkets.add(
    'refresh-pinned-selection',
    { type: 'refresh-pinned-selection' },
    {
      repeat: {
        pattern: '0 */6 * * *', // Every 6 hours
      },
    }
  );
  logger.info('Scheduled: refresh-pinned-selection (every 6 hours)');

  // Analyze multi-outcome events every hour
  await queues.smartMarkets.add(
    'analyze-multi-outcome',
    { type: 'analyze-multi-outcome' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
      },
    }
  );
  logger.info('Scheduled: analyze-multi-outcome (every hour)');

}

