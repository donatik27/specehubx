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
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔥 STARTING IMMEDIATE DATA COLLECTION...');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Trigger leaderboard sync immediately (TOP-1000 MONTH ONLY)
  await queues.ingestion.add(
    'sync-leaderboard-immediate',
    { type: 'sync-leaderboard' },
    { priority: 1 }
  );
  logger.info('✅ [1/3] Leaderboard sync queued (TOP-1000 MONTH, starts NOW)');
  
  // Trigger markets sync immediately (after 10 seconds)
  await queues.ingestion.add(
    'sync-markets-immediate',
    { type: 'sync-markets' },
    { delay: 10000, priority: 1 }
  );
  logger.info('✅ [2/3] Markets sync queued (starts in 10 seconds)');
  
  // Trigger PUBLIC TRADERS discovery immediately (after leaderboard + markets)
  // Wait 2 minutes to ensure leaderboard is fully complete
  await queues.ingestion.add(
    'find-public-traders-immediate',
    { type: 'find-public-traders' },
    { delay: 120000, priority: 2 } // 2 minutes delay
  );
  logger.info('✅ [3/3] FIND PUBLIC TRADERS queued (starts in 2 minutes)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('⏰ Timeline:');
  logger.info('   NOW        → Leaderboard TOP-1000 (month only)');
  logger.info('   +10 sec    → Markets');
  logger.info('   +2 min     → 🔍 Find 150 PUBLIC traders with Twitter');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🎉 Worker is running!');
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

