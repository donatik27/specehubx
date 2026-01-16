import Redis from 'ioredis';
import { logger } from './logger';

// Use REDIS_URL from Railway, or fallback to localhost for development
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error }, 'Redis connection error');
});

export default redis;

