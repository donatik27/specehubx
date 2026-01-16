// Tier type - must match Prisma schema enum
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TraderFilters {
  tier?: string[];
  minPnl?: number;
  maxPnl?: number;
  search?: string;
  sortBy?: 'pnl' | 'rarityScore' | 'winRate' | 'lastActive';
  sortOrder?: 'asc' | 'desc';
}

export interface MarketFilters {
  category?: string;
  status?: string;
  search?: string;
}

export interface SmartMarketFilters extends MarketFilters {
  timeframe?: 'day' | 'week' | 'month' | 'all';
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: boolean;
  redis: boolean;
  lastIngestion?: {
    leaderboard?: Date;
    trades?: Date;
    markets?: Date;
  };
}

