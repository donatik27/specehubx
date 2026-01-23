import 'dotenv/config';
import { logger } from './lib/logger';
import { startWorkers } from './workers';
import { scheduleJobs } from './scheduler';
import { queues } from './lib/queue';

// Trigger Railway rebuild v7 - AUTO FIX SCORES ON STARTUP!
async function main() {
  logger.info('🚀 Starting Polymarket Worker...');

  // Start workers
  await startWorkers();
  logger.info('✅ Workers started');

  // Schedule recurring jobs
  await scheduleJobs();
  logger.info('✅ Jobs scheduled');

  // 🔧 FIX BROKEN SCORES - run score recalculation immediately!
  logger.info('🔧 Queuing score recalculation (fix > 1000 scores)...');
  await queues.scoring.add(
    'fix-broken-scores-startup',
    { type: 'recalculate-all-scores' },
    { priority: 10, delay: 5000 } // Run after 5 seconds
  );
  logger.info('✅ Score fix queued (will normalize all to 0-1000)');

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
  
  // 🎯 SYNC PUBLIC TRADERS - X/Twitter traders with all-time PnL
  await queues.ingestion.add(
    'sync-public-traders-delayed',
    { type: 'sync-public-traders' },
    { delay: 300000, priority: 1 }
  );
  logger.info('✅ [3/3] SYNC PUBLIC TRADERS queued (starts in 5 minutes)');
  
  // 🧠 ALPHA MARKETS - Discover smart markets (delayed to save memory)
  await queues.smartMarkets.add(
    'discover-new-markets-immediate',
    { type: 'discover-new-markets' },
    { delay: 300000, priority: 1 } // Start in 5 minutes (after leaderboard completes)
  );
  logger.info('✅ [2/3] Alpha Markets discovery queued (starts in 5 minutes)');
  
  // 🎯 Multi-outcome analysis
  await queues.smartMarkets.add(
    'analyze-multi-outcome-immediate',
    { type: 'analyze-multi-outcome' },
    { delay: 900000, priority: 1 } // Start in 15 minutes
  );
  logger.info('✅ [3/3] Multi-outcome analysis queued (starts in 15 minutes)');
  
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('⏰ Timeline:');
  logger.info('   NOW        → Leaderboard TOP-1000 (month only)');
  logger.info('   +5 min     → Alpha Markets discovery (events + single)');
  logger.info('   +15 min    → Multi-outcome analysis');
  logger.info('   CONTINUOUS → Auto-sync every 5-30 min');
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

// Force rebuild Thu Jan 22 14:48:15 CET 2026
