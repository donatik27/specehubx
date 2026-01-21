import 'dotenv/config';
import { logger } from './lib/logger';
import { startWorkers } from './workers';
import { scheduleJobs } from './scheduler';
import { queues } from './lib/queue';

// Trigger Railway rebuild v4 - FORCE DEPLOY NOW
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
  // TEMPORARILY DISABLED - focus on leaderboard + map only
  // await queues.ingestion.add(
  //   'sync-markets-immediate',
  //   { type: 'sync-markets' },
  //   { delay: 10000, priority: 1 }
  // );
  // logger.info('✅ [2/3] Markets sync queued (starts in 10 seconds)');
  
  // 🎯 SYNC PUBLIC TRADERS - DISABLED (using static X traders list now)
  // await queues.ingestion.add(
  //   'sync-public-traders-delayed',
  //   { type: 'sync-public-traders' },
  //   { delay: 300000, priority: 1 }
  // );
  // logger.info('✅ [3/3] SYNC PUBLIC TRADERS queued (starts in 5 minutes)');
  
  // 🧠 ALPHA MARKETS - Discover smart markets (delayed to save memory)
  await queues.smartMarkets.add(
    'discover-new-markets-immediate',
    { type: 'discover-new-markets' },
    { delay: 300000, priority: 1 } // Start in 5 minutes (after leaderboard completes)
  );
  logger.info('✅ [2/4] Alpha Markets discovery queued (starts in 5 minutes)');
  
  // 🔄 Update existing pinned markets (eventSlug + latest data)
  await queues.smartMarkets.add(
    'update-pinned-markets-immediate',
    { type: 'update-pinned-markets' },
    { delay: 120000, priority: 2 } // Start in 2 minutes (high priority!)
  );
  logger.info('✅ [3/6] Update pinned markets queued (starts in 2 minutes)');
  
  // 📌 Refresh pinned markets selection
  await queues.smartMarkets.add(
    'refresh-pinned-selection-immediate',
    { type: 'refresh-pinned-selection' },
    { delay: 600000, priority: 1 } // Start in 10 minutes (after discovery)
  );
  logger.info('✅ [4/6] Pinned markets refresh queued (starts in 10 minutes)');
  
  // 🎯 Multi-outcome analysis
  await queues.smartMarkets.add(
    'analyze-multi-outcome-immediate',
    { type: 'analyze-multi-outcome' },
    { delay: 900000, priority: 1 } // Start in 15 minutes
  );
  logger.info('✅ [5/6] Multi-outcome analysis queued (starts in 15 minutes)');
  
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('⏰ Timeline:');
  logger.info('   NOW        → Leaderboard TOP-1000 (month only)');
  logger.info('   +2 min     → Update pinned markets (eventSlug fix)');
  logger.info('   +5 min     → Alpha Markets discovery (50 markets)');
  logger.info('   +10 min    → Pinned markets selection');
  logger.info('   +15 min    → Multi-outcome analysis');
  logger.info('   CONTINUOUS → X traders (static list, 115 curated)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('');
  logger.info('💡 FULL SYSTEM MODE:');
  logger.info('   ✅ Leaderboard (monthly)');
  logger.info('   ✅ Alpha Markets (on-chain verified)');
  logger.info('   ✅ Trader Radar (115 X traders)');
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

