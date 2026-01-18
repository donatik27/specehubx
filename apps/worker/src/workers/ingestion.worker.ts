import { JobData } from '../lib/queue';
import { logger } from '../lib/logger';
import prisma from '@polymarket/database';

export async function handleIngestionJob(data: JobData) {
  switch (data.type) {
    case 'sync-leaderboard':
      await syncLeaderboard(data.payload);
      break;
    case 'sync-markets':
      await syncMarkets(data.payload);
      break;
    case 'sync-trader-trades':
      await syncTraderTrades(data.payload);
      break;
    case 'sync-trader-positions':
      await syncTraderPositions(data.payload);
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown ingestion job type');
  }
}

// Tier assignment function
function assignTier(trader: any, leaderboard: any[]) {
  const rank = leaderboard.findIndex(t => t.proxyWallet === trader.proxyWallet) + 1;
  const totalTraders = leaderboard.length;
  const percentile = rank / totalTraders;
  
  const isPublic = trader.xUsername || trader.verifiedBadge;
  
  if (isPublic || percentile <= 0.001) return 'S';
  if (percentile <= 0.01) return 'A';
  if (percentile <= 0.05) return 'B';
  if (percentile <= 0.20) return 'C';
  if (percentile <= 0.50) return 'D';
  return 'E';
}

async function syncLeaderboard(payload: any) {
  logger.info('🚀 Syncing leaderboard (top 1000 traders)...');
  
  try {
    const allTraders: any[] = [];
    const BATCH_SIZE = 100;
    
    // Fetch top 1000 traders in batches
    for (let offset = 0; offset < 1000; offset += BATCH_SIZE) {
      logger.info(`📥 Fetching batch ${Math.floor(offset / BATCH_SIZE) + 1}/10 (offset: ${offset})...`);
      
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?timePeriod=month&orderBy=PNL&limit=${BATCH_SIZE}&offset=${offset}`
      );
      
      if (!res.ok) {
        logger.error({ status: res.status }, 'Polymarket API error');
        break;
      }
      
      const batch = await res.json();
      
      if (batch.length === 0) {
        logger.info(`✅ Reached end of leaderboard at ${allTraders.length} traders`);
        break;
      }
      
      allTraders.push(...batch);
      logger.info(`   Fetched ${batch.length} traders (total: ${allTraders.length})`);
      
      // Small pause to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(`✅ Fetched ${allTraders.length} traders total`);
    
    // Assign tiers and save to DB
    logger.info('💾 Saving traders to database...');
    let saved = 0;
    
    for (const t of allTraders) {
      if (!t.proxyWallet) continue;
      
      try {
        await prisma.trader.upsert({
          where: { address: t.proxyWallet },
          create: {
            address: t.proxyWallet,
            displayName: t.userName || `${t.proxyWallet?.slice(0, 6)}...`,
            profilePicture: t.profilePicture || null,
            twitterUsername: t.xUsername || null,
            tier: assignTier(t, allTraders),
            realizedPnl: t.pnl || 0,
            totalPnl: t.pnl || 0,
            rarityScore: 0,
            tradeCount: 0,
          },
          update: {
            displayName: t.userName || undefined,
            profilePicture: t.profilePicture || undefined,
            twitterUsername: t.xUsername || undefined,
            tier: assignTier(t, allTraders),
            realizedPnl: t.pnl || 0,
            totalPnl: t.pnl || 0,
            lastActiveAt: new Date(),
          },
        });
        saved++;
      } catch (error: any) {
        logger.error({ error: error.message, address: t.proxyWallet }, 'Failed to save trader');
      }
    }
    
    // Count by tier
    const counts = await prisma.trader.groupBy({
      by: ['tier'],
      _count: { tier: true },
    });
    
    logger.info('📊 Tier distribution:');
    for (const c of counts) {
      logger.info(`   ${c.tier}-tier: ${c._count.tier}`);
    }
    
    // Update ingestion state
    await prisma.ingestionState.upsert({
      where: {
        source_key: {
          source: 'leaderboard',
          key: 'global',
        },
      },
      create: {
        source: 'leaderboard',
        key: 'global',
        lastTimestamp: new Date(),
      },
      update: {
        lastTimestamp: new Date(),
      },
    });
    
    logger.info(`✅ Leaderboard sync completed! Saved ${saved} traders`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Leaderboard sync failed');
    throw error;
  }
}

async function syncMarkets(payload: any) {
  logger.info('🔄 Syncing markets...');
  
  try {
    const res = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=500');
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    
    const markets = await res.json();
    logger.info(`📥 Fetched ${markets.length} active markets`);
    
    let saved = 0;
    for (const m of markets) {
      if (!m.id) continue;
      
      try {
        await prisma.market.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            question: m.question || 'Unknown',
            category: m.category || 'Uncategorized',
            eventSlug: m.eventSlug || null,
            slug: m.slug || null,
            endDate: m.endDate ? new Date(m.endDate) : null,
            liquidity: m.liquidityNum || 0,
            volume: m.volumeNum || 0,
            status: m.closed ? 'CLOSED' : 'OPEN',
          },
          update: {
            question: m.question || undefined,
            category: m.category || undefined,
            eventSlug: m.eventSlug || undefined,
            slug: m.slug || undefined,
            endDate: m.endDate ? new Date(m.endDate) : undefined,
            liquidity: m.liquidityNum || undefined,
            volume: m.volumeNum || undefined,
            status: m.closed ? 'CLOSED' : 'OPEN',
          },
        });
        saved++;
      } catch (error: any) {
        logger.error({ error: error.message, marketId: m.id }, 'Failed to save market');
      }
    }
    
    // Update ingestion state
    await prisma.ingestionState.upsert({
      where: {
        source_key: {
          source: 'markets',
          key: 'all',
        },
      },
      create: {
        source: 'markets',
        key: 'all',
        lastTimestamp: new Date(),
      },
      update: {
        lastTimestamp: new Date(),
      },
    });
    
    logger.info(`✅ Markets sync completed! Saved ${saved} markets`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Markets sync failed');
    throw error;
  }
}

async function syncTraderTrades(payload: any) {
  logger.info({ trader: payload?.traderId }, 'Syncing trader trades...');
  // TODO: Implement if needed for detailed trader profiles
  logger.info('Trader trades sync completed (stub)');
}

async function syncTraderPositions(payload: any) {
  logger.info({ trader: payload?.traderId }, 'Syncing trader positions...');
  // TODO: Implement if needed for detailed trader profiles
  logger.info('Trader positions sync completed (stub)');
}
