import { Queue } from 'bullmq';
import redis from './redis';

export const queues = {
  ingestion: new Queue('ingestion', { connection: redis }),
  scoring: new Queue('scoring', { connection: redis }),
  smartMarkets: new Queue('smart-markets', { connection: redis }),
};

export type JobType = 
  | 'sync-leaderboard'
  | 'sync-markets'
  | 'find-public-traders'
  | 'sync-trader-trades'
  | 'sync-trader-positions'
  | 'calculate-rarity-scores'
  | 'calculate-smart-markets'
  | 'analyze-multi-outcome'
  | 'update-pinned-markets'
  | 'discover-new-markets'
  | 'refresh-pinned-selection';

export interface JobData {
  type: JobType;
  payload?: any;
}

