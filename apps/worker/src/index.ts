import 'dotenv/config';
import { logger } from './lib/logger';
import { startWorkers } from './workers';
import { scheduleJobs } from './scheduler';
import { queues } from './lib/queue';

// Trigger Railway rebuild v3
async function main() {
  logger.info('🚀 Starting Polymarket Worker...');

  // Start workers
  await startWorkers();
  logger.info('✅ Workers started');

  // Schedule recurring jobs
  await scheduleJobs();
  logger.info('✅ Jobs scheduled');

  // 🔥 IMMEDIATE FIRST RUN - don't wait 5 minutes!
  logger.info('🔥 Triggering immediate data collection...');
  
  // Trigger leaderboard sync immediately
  await queues.ingestion.add(
    'sync-leaderboard-immediate',
    { type: 'sync-leaderboard' },
    { priority: 1 }
  );
  
  // Trigger markets sync immediately (after 10 seconds)
  await queues.ingestion.add(
    'sync-markets-immediate',
    { type: 'sync-markets' },
    { delay: 10000, priority: 1 }
  );
  
  // Trigger map traders sync immediately (after leaderboard + markets)
  // Wait 3 minutes to ensure leaderboard is fully complete
  await queues.ingestion.add(
    'sync-map-traders-immediate',
    { type: 'sync-map-traders' },
    { delay: 180000, priority: 2 } // 3 minutes delay
  );
  
  logger.info('✅ Immediate jobs queued (leaderboard → markets → map-traders)');
  logger.info('🎉 Worker is running');
}

main().catch((error) => {
  logger.error({ error }, '❌ Worker startup failed');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

