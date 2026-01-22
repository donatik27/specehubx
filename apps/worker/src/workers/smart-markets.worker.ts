import { JobData } from '../lib/queue';
import { logger } from '../lib/logger';
import { prisma } from '@polymarket/database';
import { createPublicClient, http, formatUnits, encodeFunctionData, decodeFunctionResult } from 'viem';
import { polygon } from 'viem/chains';

// Polymarket CTF contract
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const CTF_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'id', type: 'uint256' }
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Multicall3
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' }
        ],
        name: 'calls',
        type: 'tuple[]'
      }
    ],
    name: 'aggregate',
    outputs: [
      { name: 'blockNumber', type: 'uint256' },
      { name: 'returnData', type: 'bytes[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export async function handleSmartMarketsJob(data: JobData) {
  switch (data.type) {
    case 'analyze-multi-outcome':
      const { analyzeMultiOutcomeEvents } = await import('./multi-outcome.worker');
      await analyzeMultiOutcomeEvents();
      break;
    case 'update-pinned-markets':
      await updatePinnedMarkets(data.payload);
      break;
    case 'discover-new-markets':
      await discoverNewMarkets(data.payload);
      break;
    case 'refresh-pinned-selection':
      await refreshPinnedSelection(data.payload);
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown smart markets job type');
  }
}

// =============================================================================
// JOB 1: Update Pinned Markets (runs every 24 hours)
// =============================================================================
async function updatePinnedMarkets(payload: any) {
  const startTime = Date.now();
  logger.info('🔄 Updating pinned markets (top-5)...');
  
  try {
    // Get current pinned markets from DB
    const pinnedMarkets = await prisma.marketSmartStats.findMany({
      where: { isPinned: true },
      orderBy: { priority: 'asc' }
    });
    
    if (pinnedMarkets.length === 0) {
      logger.info('⚠️  No pinned markets found, triggering selection...');
      await refreshPinnedSelection({});
      return;
    }
    
    logger.info(`📊 Checking ${pinnedMarkets.length} pinned markets...`);
    
    // Fetch ALL traders from DATABASE
    logger.info('📥 Loading ALL traders from database...');
    const allTraders = await prisma.trader.findMany({
      where: {
        tier: { in: ['S', 'A', 'B'] }
      },
      select: {
        address: true,
        displayName: true,
        tier: true,
        realizedPnl: true
      }
    });
    
ну     // FIX 2: Increased to TOP-300 traders (was 200) for better market coverage
    const smartTraders = allTraders
      .sort((a: any, b: any) => Number(b.realizedPnl) - Number(a.realizedPnl))
      .slice(0, 300);
    
    logger.info(`✅ Using TOP-${smartTraders.length} traders for pinned markets analysis`);
    
    // Fetch market details
    const marketIds = pinnedMarkets.map(m => m.marketId);
    const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=100');
    const allMarkets = await marketsRes.json();
    const markets = allMarkets.filter((m: any) => marketIds.includes(m.id));
    
    const client = createPublicClient({
      chain: polygon,
      transport: http('https://1rpc.io/matic', {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000
      })
    });
    
    // Update each pinned market
    for (const pinnedStat of pinnedMarkets) {
      const market = markets.find((m: any) => m.id === pinnedStat.marketId);
      if (!market) {
        logger.warn(`Market ${pinnedStat.marketId} not found, skipping...`);
        continue;
      }
      
      try {
        const analysis = await analyzeMarket(client, market, smartTraders);
        
        // Find parent event slug (for multi-outcome markets)
        const eventSlug = await findEventSlug(market);
        
        // Update Market record with latest data + eventSlug
        await prisma.market.upsert({
          where: { id: market.id },
          create: {
            id: market.id,
            question: market.question,
            category: market.category,
            slug: market.slug || null,
            eventSlug: eventSlug,
            endDate: market.endDate ? new Date(market.endDate) : null,
            liquidity: market.liquidity || null,
            volume: market.volume || null,
            status: market.closed ? 'CLOSED' : 'OPEN'
          },
          update: {
            question: market.question,
            slug: market.slug || null,
            eventSlug: eventSlug, // ✅ Update eventSlug for existing markets!
            endDate: market.endDate ? new Date(market.endDate) : null,
            volume: market.volume || null,
            liquidity: market.liquidity || null,
            status: market.closed ? 'CLOSED' : 'OPEN'  // ✅ Update status too!
          }
        });
        
        // Update smart stats in database
        await prisma.marketSmartStats.update({
          where: { id: pinnedStat.id },
          data: {
            smartCount: analysis.smartCount,
            smartWeighted: analysis.smartWeighted,
            smartScore: analysis.smartScore,
            topSmartTraders: analysis.topSmartTraders,
            lastChecked: new Date(),
            computedAt: new Date()
          }
        });
        
        logger.info(`✅ Updated pinned #${pinnedStat.priority}: ${market.question.slice(0, 40)}... (${analysis.smartCount} traders)${eventSlug ? ` [event: ${eventSlug}]` : ''}`);
      } catch (error) {
        logger.error({ error, marketId: market.id }, 'Failed to update pinned market');
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 Pinned markets updated in ${duration}s`);
    
  } catch (error) {
    logger.error({ error }, '❌ Failed to update pinned markets');
    throw error;
  }
}

// Helper: Find parent event slug for a market
async function findEventSlug(market: any): Promise<string | null> {
  try {
    if (!market.negRiskMarketID) return null;
    
    // STRATEGY 1: Direct fetch by condition_id (most reliable!)
    try {
      const clobRes = await fetch(`https://clob.polymarket.com/markets/${market.id}`);
      if (clobRes.ok) {
        const clobData = await clobRes.json();
        if (clobData.condition_id) {
          // Fetch event by condition_id
          const eventRes = await fetch(`https://gamma-api.polymarket.com/events?id=${clobData.condition_id}`);
          if (eventRes.ok) {
            const events = await eventRes.json();
            if (events && events[0]) {
              logger.info(`✅ Found event "${events[0].title}" (${events[0].slug}) via CLOB API`);
              return events[0].slug;
            }
          }
        }
      }
    } catch (e) {
      logger.debug('CLOB API method failed, trying fallback...');
    }
    
    // STRATEGY 2: Search in top 500 active events
    const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=500');
    if (eventsRes.ok) {
      const events = await eventsRes.json();
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          const hasMatch = event.markets.some((m: any) => 
            String(m.id) === String(market.id) || 
            m.negRiskMarketID === market.negRiskMarketID
          );
          if (hasMatch) {
            logger.info(`✅ Found event "${event.title}" (${event.slug}) for market ${market.id}`);
            return event.slug;
          }
        }
      }
    }
    
    logger.warn(`⚠️  No event found for market ${market.id}`);
  } catch (error) {
    logger.warn({ error, marketId: market.id }, 'Failed to find event slug');
  }
  return null;
}

// =============================================================================
// JOB 2: Discover New Markets (runs every 30 minutes)
// =============================================================================
async function discoverNewMarkets(payload: any) {
  const startTime = Date.now();
  logger.info('🔍 Discovering new smart markets...');
  
  try {
    // Fetch ALL traders from DATABASE
    logger.info('📥 Loading ALL traders from database...');
    const allTraders = await prisma.trader.findMany({
      where: {
        tier: { in: ['S', 'A', 'B'] }  // Only S/A/B tier
      },
      select: {
        address: true,
        displayName: true,
        tier: true,
        realizedPnl: true
      }
    });
    
    logger.info(`✅ Loaded ${allTraders.length} S/A/B tier traders from DB`);
    logger.info(`   S-tier: ${allTraders.filter((t: any) => t.tier === 'S').length}`);
    logger.info(`   A-tier: ${allTraders.filter((t: any) => t.tier === 'A').length}`);
    logger.info(`   B-tier: ${allTraders.filter((t: any) => t.tier === 'B').length}`);
    
    // FIX 2: Increased to TOP-300 traders (was 200) for better market coverage (300 traders × 2 tokens = 600 calls)
    const smartTraders = allTraders
      .sort((a: any, b: any) => Number(b.realizedPnl) - Number(a.realizedPnl))
      .slice(0, 300);
    
    logger.info(`🎯 Using TOP-${smartTraders.length} traders for analysis (increased for better Alpha Markets coverage)`);
    
    // Fetch top markets (excluding already pinned)
    const pinnedMarketIds = (await prisma.marketSmartStats.findMany({
      where: { isPinned: true },
      select: { marketId: true }
    })).map(m => m.marketId);
    
    // FIX 1: Increase market limit to 500 (was 200) for better coverage
    const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=500&closed=false&order=volume&ascending=false');
    const allMarkets = await marketsRes.json();
    
    // SIMPLE FILTER: Skip only markets that ALREADY ENDED or are CLEARLY RESOLVED
    // Don't over-filter - we want maximum coverage!
    const now = Date.now();
    const markets = allMarkets.filter((m: any) => {
      // Skip pinned markets (already tracked)
      if (pinnedMarketIds.includes(m.id)) return false;
      
      // Skip explicitly closed markets
      if (m.closed) return false;
      
      // ⚠️ CRITICAL: Skip markets where endDate ALREADY PASSED (in the past)
      // But ALLOW markets without endDate (multi-outcome, etc.)
      if (m.endDate) {
        const endDate = new Date(m.endDate).getTime();
        if (endDate < now) {
          logger.debug(`Skipping expired market: ${m.question.slice(0, 40)}... (ended ${new Date(m.endDate).toISOString()})`);
          return false;
        }
      }
      
      // Skip ONLY extreme prices (99.5%+ = virtually resolved)
      if (m.outcomePrices && Array.isArray(m.outcomePrices)) {
        const prices = m.outcomePrices.map((p: string) => parseFloat(p));
        const hasExtremePrice = prices.some((p: number) => p >= 0.995 || p <= 0.005);
        if (hasExtremePrice) {
          return false;
        }
      }
      
      return true;
    });
    
    logger.info(`📈 Filtered markets: ${markets.length} active (from ${allMarkets.length} total, ${allMarkets.length - markets.length} filtered out)`);
    logger.info(`   Filters: closed=${allMarkets.filter((m: any) => m.closed).length}, expired=${allMarkets.filter((m: any) => m.endDate && new Date(m.endDate).getTime() < now).length}, extreme_price=${allMarkets.filter((m: any) => {
      if (m.outcomePrices && Array.isArray(m.outcomePrices)) {
        const prices = m.outcomePrices.map((p: string) => parseFloat(p));
        return prices.some((p: number) => p >= 0.995 || p <= 0.005);
      }
      return false;
    }).length}`);
    
    const client = createPublicClient({
      chain: polygon,
      transport: http('https://1rpc.io/matic', {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000
      })
    });
    
    let discoveredCount = 0;
    
    // BATCHING: Process 10 markets at a time (increased from 5 for faster processing)
    const BATCH_SIZE = 10;
    for (let i = 0; i < markets.length; i += BATCH_SIZE) {
      const batch = markets.slice(i, i + BATCH_SIZE);
      logger.info(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(markets.length / BATCH_SIZE)} (${batch.length} markets)...`);
      
      for (const market of batch) {
        try {
          const analysis = await analyzeMarket(client, market, smartTraders);
        
        // Only save if it has at least 2 smart traders (quality threshold)
        if (analysis.smartCount >= 2) {
          // Check if already exists
          const existing = await prisma.marketSmartStats.findFirst({
            where: {
              marketId: market.id,
              computedAt: {
                gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
              }
            }
          });
          
          if (!existing) {
            // Find parent event slug
            const eventSlug = await findEventSlug(market);
            
            // Create/update Market record first
            await prisma.market.upsert({
              where: { id: market.id },
              create: {
                id: market.id,
                question: market.question,
                category: market.category,
                slug: market.slug || null,
                eventSlug: eventSlug,
                endDate: market.endDate ? new Date(market.endDate) : null,
                liquidity: market.liquidity || null,
                volume: market.volume || null,
                status: market.closed ? 'CLOSED' : 'OPEN'
              },
              update: {
                question: market.question,
                slug: market.slug || null,
                eventSlug: eventSlug,
                endDate: market.endDate ? new Date(market.endDate) : null,
                volume: market.volume || null,
                status: market.closed ? 'CLOSED' : 'OPEN'  // ✅ Update status too!
              }
            });
            
            // Now create stats
            await prisma.marketSmartStats.create({
              data: {
                marketId: market.id,
                smartCount: analysis.smartCount,
                smartWeighted: analysis.smartWeighted,
                smartShare: 0,
                smartScore: analysis.smartScore,
                topSmartTraders: analysis.topSmartTraders,
                isPinned: false,
                priority: 0,
                computedAt: new Date()
              }
            });
            
            discoveredCount++;
            logger.info(`✅ Discovered: ${market.question.slice(0, 40)}... (${analysis.smartCount} traders)`);
          }
        }
        } catch (error: any) {
          logger.error({ 
            error: error.message, 
            marketId: market.id,
            question: market.question?.slice(0, 40)
          }, 'Failed to analyze market');
        }
      }
      
      // Pause between batches to avoid rate limits
      if (i + BATCH_SIZE < markets.length) {
        logger.info('⏸️  Pausing 2s before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 Discovery complete! Found ${discoveredCount} new smart markets in ${duration}s`);
    
  } catch (error) {
    logger.error({ error }, '❌ Failed to discover new markets');
    throw error;
  }
}

// =============================================================================
// JOB 3: Refresh Pinned Selection (runs every 6 hours)
// =============================================================================
async function refreshPinnedSelection(payload: any) {
  const startTime = Date.now();
  logger.info('🔄 Refreshing pinned markets selection...');
  
  try {
    // Get all smart markets (last 24 hours)
    const allSmartMarkets = await prisma.marketSmartStats.findMany({
      where: {
        computedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        smartScore: 'desc'
      }
    });
    
    if (allSmartMarkets.length === 0) {
      logger.warn('⚠️  No smart markets found, running discovery first...');
      await discoverNewMarkets({});
      return;
    }
    
    // Fetch market details to check endDate
    const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=100');
    const allMarkets = await marketsRes.json();
    
    // Select top-5 based on criteria:
    // 1. Long deadline (endDate > 14 days)
    // 2. High smartScore
    // 3. Popular categories
    const candidates = allSmartMarkets
      .map(stat => {
        const market = allMarkets.find((m: any) => m.id === stat.marketId);
        if (!market) return null;
        
        const endDate = market.endDate ? new Date(market.endDate) : null;
        const daysUntilEnd = endDate ? (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : 0;
        
        // Must have at least 7 days until end (was 14, too strict!)
        if (daysUntilEnd < 7) return null;
        
        return {
          stat,
          market,
          daysUntilEnd,
          score: Number(stat.smartScore) * Math.log(1 + daysUntilEnd)
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5);
    
    if (candidates.length < 5) {
      logger.warn(`⚠️  Only found ${candidates.length} candidates for pinning`);
    }
    
    // Unpin all current pinned markets
    await prisma.marketSmartStats.updateMany({
      where: { isPinned: true },
      data: {
        isPinned: false,
        priority: 0,
        pinnedAt: null
      }
    });
    
    // Pin new top-5
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i] as any;
      await prisma.marketSmartStats.update({
        where: { id: candidate.stat.id },
        data: {
          isPinned: true,
          priority: i + 1,
          pinnedAt: new Date(),
          lastChecked: new Date()
        }
      });
      
      logger.info(`📌 Pinned #${i + 1}: ${candidate.market.question.slice(0, 50)}... (${candidate.daysUntilEnd.toFixed(0)} days left)`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 Pinned selection refreshed in ${duration}s`);
    
  } catch (error) {
    logger.error({ error }, '❌ Failed to refresh pinned selection');
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function analyzeMarket(client: any, market: any, traders: any[]) {
  try {
    const tokenIds = JSON.parse(market.clobTokenIds || '[]');
    if (tokenIds.length === 0) {
      throw new Error('No tokenIds');
    }
    
    // 🔍 DEBUG: Log market and token info
    logger.info(`🔬 Analyzing market: ${market.question.slice(0, 50)}...`);
    logger.info(`   TokenIds: ${tokenIds.join(', ')} (${tokenIds.length} tokens)`);
    logger.info(`   Traders to check: ${traders.length}`);
  
  // Build multicall
  const calls = [];
  for (const trader of traders) {
    for (const tokenId of tokenIds) {
      calls.push({
        target: CTF_CONTRACT,
        callData: encodeFunctionData({
          abi: CTF_ABI,
          functionName: 'balanceOf',
          args: [trader.address as `0x${string}`, BigInt(tokenId)]
        })
      });
    }
  }
  
  // Execute multicall
  const results = await client.readContract({
    address: MULTICALL3,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate',
    args: [calls]
  });
  
  // Parse results
  const tradersWithPositions = [];
  let callIndex = 0;
  
  // Get current prices for entry price estimation
  const outcomePrices = market.outcomePrices 
    ? (typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices)
    : ['0.5', '0.5'];
  
  // Check if this is a YES/NO market (2 tokens) or multi-outcome (3+ tokens)
  const isYesNoMarket = tokenIds.length === 2;
  
  for (const trader of traders) {
    let hasPosition = false;
    let totalBalance = 0;
    const balances: number[] = [];
    
    // Read all token balances for this trader
    for (let i = 0; i < tokenIds.length; i++) {
      const returnData = results[1][callIndex];
      const balance = returnData ? Number(formatUnits(BigInt(returnData as string), 6)) : 0;
      balances.push(balance);
      totalBalance += balance;
      if (balance > 0) hasPosition = true;
      callIndex++;
    }
    
    if (hasPosition) {
      // For YES/NO markets, track position side
      if (isYesNoMarket) {
        const yesBalance = balances[0];
        const noBalance = balances[1];
        const yesPrice = parseFloat(outcomePrices[0] || '0.5');
        const noPrice = parseFloat(outcomePrices[1] || '0.5');
        
        const side = yesBalance > noBalance ? 'YES' : 'NO';
        const shares = Math.max(yesBalance, noBalance);
        const entryPrice = side === 'YES' ? yesPrice : noPrice;
        
        // 🔍 DEBUG: Log found position
        logger.info(`   ✅ ${trader.displayName || trader.address.slice(0, 8)}: ${side} ${shares.toFixed(0)} shares @ ${(entryPrice * 100).toFixed(1)}%`);
        
        tradersWithPositions.push({
          ...trader,
          side,           // ✅ YES or NO
          shares,         // ✅ Number of shares
          entryPrice,     // ✅ Current price
          balance: totalBalance
        });
      } else {
        // Multi-outcome market: just track total balance
        logger.info(`   ✅ ${trader.displayName || trader.address.slice(0, 8)}: ${totalBalance.toFixed(0)} shares (multi-outcome)`);
        
        tradersWithPositions.push({
          ...trader,
          balance: totalBalance
        });
      }
    }
  }
  
  // Calculate metrics
  const smartCount = tradersWithPositions.length;
  const smartWeighted = tradersWithPositions.reduce((sum, t) => {
    const tierWeight = t.tier === 'S' ? 5 : t.tier === 'A' ? 3 : 1;
    return sum + tierWeight;
  }, 0);
  const smartScore = smartWeighted * Math.log(1 + (market.volume || 0) / 1000000);
  
  // 🔍 DEBUG: Summary
  logger.info(`   📊 Found ${smartCount} traders with positions (returning top 6)`);
  if (smartCount > 0 && isYesNoMarket) {
    const sample = tradersWithPositions[0];
    logger.info(`   📝 Sample data: side=${sample.side}, shares=${sample.shares}, entryPrice=${sample.entryPrice}`);
  }
  
  return {
    smartCount,
    smartWeighted,
    smartScore,
    topSmartTraders: tradersWithPositions.slice(0, 6)
  };
  } catch (error: any) {
    throw new Error(`analyzeMarket failed: ${error.message}`);
  }
}

function assignTier(trader: any, leaderboard: any[]) {
  const index = leaderboard.indexOf(trader);
  if (index < 10) return 'S';
  if (index < 30) return 'A';
  return 'B';
}
