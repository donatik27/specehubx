import 'dotenv/config';
import { handleIngestionJob } from './workers/ingestion.worker';
import { logger } from './lib/logger';

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🚀 MANUAL RUN: Sync Public Traders');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await handleIngestionJob({
    type: 'sync-public-traders',
    payload: {}
  });
  
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('✅ DONE! Check your site now.');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  process.exit(0);
}

main().catch((error) => {
  logger.error({ error }, '❌ Failed to run sync');
  process.exit(1);
});
