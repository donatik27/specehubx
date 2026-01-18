import 'dotenv/config';
import { logger } from './lib/logger';
import { queues } from './lib/queue';

// Manually trigger map traders sync
async function main() {
  logger.info('🔥 MANUALLY TRIGGERING MAP TRADERS SYNC...');
  
  try {
    await queues.ingestion.add(
      'sync-map-traders-manual',
      { type: 'sync-map-traders' },
      { priority: 10 } // High priority - run immediately
    );
    
    logger.info('✅ Map traders sync job queued!');
    logger.info('⏰ Worker should start processing in a few seconds...');
    
    // Wait a bit to ensure job is queued
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info('✅ Done! Check Worker logs for progress.');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Failed to queue job');
    process.exit(1);
  }
}

main();
