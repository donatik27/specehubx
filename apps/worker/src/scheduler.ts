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
  await removeRepeatables(queues.smartMarkets, [
    'update-pinned-markets',
    'discover-new-markets',
    'refresh-pinned-selection',
    'analyze-multi-outcome',
  ]);

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
  // Temporarily disabled to keep worker focused on leaderboard + media + map

}

