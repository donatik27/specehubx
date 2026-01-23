/**
 * ========================================
 * ALPHA MARKETS WORKER - REBUILT FROM SCRATCH
 * ========================================
 * 
 * SIMPLE & CLEAN IMPLEMENTATION:
 * 
 * 1. FETCH 500 markets from Polymarket API
 * 2. FILTER: exclude Closed, past endDate, 95%+ price
 * 3. ANALYZE: check S/A/B tier traders' on-chain positions
 * 4. SAVE: markets with 2+ traders having positions
 * 5. DISPLAY: top-10 traders with full data (name, tier, side, shares, price, amount)
 * 
 * NO PINNED SYSTEM - just sort all markets by score and show top-50
 */

import { JobData } from '../lib/queue';

import { createPublicClient, http, encodeFunctionData, formatUnits } from 'viem';
import { polygon } from 'viem/chains';
import { prisma } from '@polymarket/database';
import { logger } from '../lib/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

const CTF_CONTRACT = '0x4d97dcd97ec945f40cf65f87097ace5ea0476045' as `0x${string}`;
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as `0x${string}`;

const CTF_ABI = [{
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'id', type: 'uint256' }
  ],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
}] as const;

const MULTICALL3_ABI = [{
  inputs: [{ 
    components: [
      { name: 'target', type: 'address' },
      { name: 'callData', type: 'bytes' }
    ],
    name: 'calls',
    type: 'tuple[]'
  }],
  name: 'aggregate',
  outputs: [
    { name: 'blockNumber', type: 'uint256' },
    { name: 'returnData', type: 'bytes[]' }
  ],
  stateMutability: 'view',
  type: 'function'
}] as const;

// ============================================================================
// TYPES
// ============================================================================

interface Trader {
  address: string;
  displayName: string | null;
  tier: 'S' | 'A' | 'B';
  realizedPnl: any;
}

interface TraderPosition {
  address: string;
  displayName: string | null;
  tier: 'S' | 'A' | 'B';
  side: 'YES' | 'NO';
  shares: number;
  entryPrice: number;
}

interface MarketAnalysis {
  smartCount: number;
  smartWeighted: number;
  smartScore: number;
  topTraders: TraderPosition[];
}

// ============================================================================
// JOB HANDLER
// ============================================================================

export async function handleSmartMarketsJob(data: JobData) {
  switch (data.type) {
    case 'discover-new-markets':
      await discoverAlphaMarkets();
      break;
    case 'analyze-multi-outcome':
      // Keep multi-outcome analysis (separate worker)
      const { analyzeMultiOutcomeEvents } = await import('./multi-outcome.worker');
      await analyzeMultiOutcomeEvents();
      break;
    default:
      logger.warn({ type: data.type }, 'Unknown smart markets job type');
  }
}

// ============================================================================
// MAIN JOB: DISCOVER ALPHA MARKETS
// ============================================================================

async function discoverAlphaMarkets() {
  const startTime = Date.now();
  logger.info('🚀 STARTING ALPHA MARKETS DISCOVERY (REBUILT VERSION)');
  
  try {
    // STEP 0A: Clean up OLD markets (>48h)
    logger.info('🧹 STEP 0A: Cleaning up OLD market stats (>48h)...');
    await cleanupOldMarkets();
    
    // STEP 0B: Clean up duplicates (keep only most recent per market)
    logger.info('🧹 STEP 0B: Cleaning up duplicates...');
    const allStats = await prisma.marketSmartStats.findMany({
      orderBy: { computedAt: 'desc' }
    });
    
    const seen = new Set<string>();
    const toDelete: number[] = [];
    
    for (const stat of allStats) {
      if (seen.has(stat.marketId)) {
        toDelete.push(stat.id);
      } else {
        seen.add(stat.marketId);
      }
    }
    
    if (toDelete.length > 0) {
      await prisma.marketSmartStats.deleteMany({
        where: { id: { in: toDelete } }
      });
      logger.info(`   ✅ Deleted ${toDelete.length} duplicate records`);
    } else {
      logger.info(`   ✅ No duplicates found`);
    }
    
    // STEP 1: Fetch TOP S/A/B tier traders from database (increased for better coverage!)
    logger.info('📥 STEP 1: Loading TOP S/A/B tier traders...');
    const allTraders = await prisma.trader.findMany({
      where: {
        tier: { in: ['S', 'A', 'B'] }
      },
      select: {
        address: true,
        displayName: true,
        tier: true,
        realizedPnl: true
      },
      orderBy: {
        realizedPnl: 'desc'
      },
      take: 500 // INCREASED to 500 for better event coverage! (was 200)
    });
    
    logger.info(`   ✅ Loaded TOP-${allTraders.length} traders (S: ${allTraders.filter(t => t.tier === 'S').length}, A: ${allTraders.filter(t => t.tier === 'A').length}, B: ${allTraders.filter(t => t.tier === 'B').length})`);
    
    // STEP 2: Fetch 500 markets from Polymarket API
    logger.info('📥 STEP 2: Fetching 500 markets from Polymarket...');
    const marketsRes = await fetch('https://gamma-api.polymarket.com/markets?limit=500&closed=false&order=volume&ascending=false');
    const allMarkets = await marketsRes.json();
    logger.info(`   ✅ Fetched ${allMarkets.length} markets`);
    
    // STEP 3: Filter markets
    logger.info('🔍 STEP 3: Filtering markets...');
    const now = Date.now();
    const filteredMarkets = allMarkets.filter((m: any) => {
      // Exclude closed
      if (m.closed) return false;
      
      // Exclude past endDate
      if (m.endDate) {
        const endDate = new Date(m.endDate).getTime();
        if (endDate < now) return false;
      }
      
      // Exclude 95%+ price (effectively resolved)
      if (m.outcomePrices && Array.isArray(m.outcomePrices)) {
        const prices = m.outcomePrices.map((p: string) => parseFloat(p));
        const hasExtremePrice = prices.some((p: number) => p >= 0.95 || p <= 0.05);
        if (hasExtremePrice) return false;
      }
      
      return true;
    });
    
    logger.info(`   ✅ ${filteredMarkets.length} markets passed filters (${allMarkets.length - filteredMarkets.length} filtered out)`);
    
    // STEP 4: LIMIT markets per run (prevent crashes!)
    const MAX_MARKETS_PER_RUN = 50; // Process max 50 markets to avoid timeouts
    const marketsToAnalyze = filteredMarkets.slice(0, MAX_MARKETS_PER_RUN);
    
    if (filteredMarkets.length > MAX_MARKETS_PER_RUN) {
      logger.info(`   ⚠️  Limited to ${MAX_MARKETS_PER_RUN} markets (out of ${filteredMarkets.length}) to prevent timeout`);
    }
    
    // STEP 5: Create RPC client for on-chain data
    const client = createPublicClient({
      chain: polygon,
      transport: http('https://1rpc.io/matic', {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000
      })
    });
    
    // STEP 6: Analyze each market (detect if event or single market)
    logger.info(`🔬 STEP 6: Analyzing ${marketsToAnalyze.length} markets for trader positions...`);
    let savedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < marketsToAnalyze.length; i++) {
      const market = marketsToAnalyze[i];
      
      try {
        logger.info(`   [${i + 1}/${marketsToAnalyze.length}] ${market.question.slice(0, 50)}...`);
        
        // CHECK: Is this a multi-outcome EVENT?
        if (market.negRiskMarketID) {
          logger.info(`      🎯 EVENT DETECTED! Fetching all outcomes...`);
          
          // Fetch event data from Polymarket
          const eventData = await fetchEventByConditionId(market.negRiskMarketID);
          
          if (eventData && eventData.markets && eventData.markets.length > 2) {
            logger.info(`      📊 Found ${eventData.markets.length} outcomes in event`);
            
            // Analyze ALL outcomes in this event
            const eventAnalysis = await analyzeEvent(client, eventData, allTraders as Trader[]);
            
            if (eventAnalysis.totalTraders >= 2) {
              await saveEvent(eventData, eventAnalysis);
              savedCount++;
              logger.info(`      ✅ SAVED EVENT with ${eventAnalysis.totalTraders} traders across ${eventAnalysis.outcomesWithTraders} outcomes`);
            } else {
              logger.info(`      ⏭️  SKIPPED EVENT (only ${eventAnalysis.totalTraders} traders)`);
            }
            
            continue; // Skip single market analysis for this
          }
        }
        
        // SINGLE YES/NO MARKET analysis
        const analysis = await Promise.race([
          analyzeMarket(client, market, allTraders as Trader[]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Market analysis timeout')), 60000) // 60s timeout
          )
        ]) as MarketAnalysis;
        
        // Save if 2+ traders found
        if (analysis.smartCount >= 2) {
          await saveMarket(market, analysis);
          savedCount++;
          logger.info(`      ✅ SAVED with ${analysis.smartCount} traders`);
        } else {
          logger.info(`      ⏭️  SKIPPED (only ${analysis.smartCount} traders)`);
        }
        
      } catch (error: any) {
        errorCount++;
        logger.error(`      ❌ ERROR: ${error.message}`);
        
        // Stop if too many errors (something is seriously wrong)
        if (errorCount > 10) {
          logger.error('🛑 Too many errors (>10), stopping to prevent crash');
          break;
        }
      }
      
      // Pause between markets to avoid rate limits
      if (i < marketsToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 DISCOVERY COMPLETE! Saved ${savedCount} Alpha Markets in ${duration}s`);
    
    if (errorCount > 0) {
      logger.warn(`⚠️  Encountered ${errorCount} errors during discovery`);
    }
    
    if (filteredMarkets.length > MAX_MARKETS_PER_RUN) {
      logger.info(`ℹ️  ${filteredMarkets.length - MAX_MARKETS_PER_RUN} markets remaining for next run`);
    }
    
  } catch (error) {
    logger.error({ error }, '❌ Discovery failed');
    throw error;
  }
}

// ============================================================================
// ANALYZE MARKET: Check on-chain positions
// ============================================================================

async function analyzeMarket(
  client: any,
  market: any,
  traders: Trader[]
): Promise<MarketAnalysis> {
  
  // Parse tokenIds
  const tokenIds = JSON.parse(market.clobTokenIds || '[]');
  if (tokenIds.length === 0) {
    throw new Error('No tokenIds');
  }
  
  const isYesNoMarket = tokenIds.length === 2;
  
  // Parse prices
  const outcomePrices = market.outcomePrices 
    ? (typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices)
    : ['0.5', '0.5'];
  
  // Build multicall for ALL traders
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
  const tradersWithPositions: TraderPosition[] = [];
  let callIndex = 0;
  
  for (const trader of traders) {
    const balances: number[] = [];
    
    // Read all token balances
    for (let i = 0; i < tokenIds.length; i++) {
      const returnData = results[1][callIndex];
      const balance = returnData ? Number(formatUnits(BigInt(returnData as string), 6)) : 0;
      balances.push(balance);
      callIndex++;
    }
    
    const totalBalance = balances.reduce((sum, b) => sum + b, 0);
    
    // Include trader if they have ANY position (even 0.1 shares)
    if (totalBalance > 0.1) {
      
      // For YES/NO markets, determine side
      if (isYesNoMarket) {
        const yesBalance = balances[0];
        const noBalance = balances[1];
        const yesPrice = parseFloat(outcomePrices[0] || '0.5');
        const noPrice = parseFloat(outcomePrices[1] || '0.5');
        
        const side = yesBalance > noBalance ? 'YES' : 'NO';
        const shares = Math.max(yesBalance, noBalance);
        const entryPrice = side === 'YES' ? yesPrice : noPrice;
        
        tradersWithPositions.push({
          address: trader.address,
          displayName: trader.displayName,
          tier: trader.tier as 'S' | 'A' | 'B',
          side,
          shares,
          entryPrice
        });
      } else {
        // For multi-outcome markets (3+ outcomes), find the outcome with highest balance
        const maxBalanceIndex = balances.indexOf(Math.max(...balances));
        const maxBalance = balances[maxBalanceIndex];
        const outcomePrice = parseFloat(outcomePrices[maxBalanceIndex] || '0.5');
        
        // Only add if they have significant position in ONE outcome
        if (maxBalance > 0.1) {
          tradersWithPositions.push({
            address: trader.address,
            displayName: trader.displayName,
            tier: trader.tier as 'S' | 'A' | 'B',
            side: 'YES', // For multi-outcome, side is always "YES" on their chosen outcome
            shares: maxBalance,
            entryPrice: outcomePrice
          });
        }
      }
    }
  }
  
  // Sort by shares (biggest positions first)
  tradersWithPositions.sort((a, b) => b.shares - a.shares);
  
  // Calculate metrics
  const smartCount = tradersWithPositions.length;
  const smartWeighted = tradersWithPositions.reduce((sum, t) => {
    const tierWeight = t.tier === 'S' ? 5 : t.tier === 'A' ? 3 : 1;
    return sum + tierWeight;
  }, 0);
  const smartScore = smartWeighted * Math.log(1 + (market.volume || 0) / 1000000);
  
  return {
    smartCount,
    smartWeighted,
    smartScore,
    topTraders: tradersWithPositions.slice(0, 10) // TOP-10!
  };
}

// ============================================================================
// SAVE MARKET: Store to database
// ============================================================================

async function saveMarket(market: any, analysis: MarketAnalysis) {
  
  // Check if this market was recently analyzed (skip if analyzed in last 24 hours)
  const recentAnalysis = await prisma.marketSmartStats.findFirst({
    where: {
      marketId: market.id,
      computedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  });
  
  if (recentAnalysis) {
    const hoursAgo = Math.round((Date.now() - recentAnalysis.computedAt.getTime()) / 1000 / 60 / 60);
    logger.info(`      ⏭️  Skipping save - market analyzed ${hoursAgo}h ago`);
    return;
  }
  
  // Create/update Market record
  await prisma.market.upsert({
    where: { id: market.id },
    create: {
      id: market.id,
      question: market.question,
      category: market.category,
      slug: market.slug || null,
      eventSlug: null,
      endDate: market.endDate ? new Date(market.endDate) : null,
      liquidity: market.liquidity || null,
      volume: market.volume || null,
      status: 'OPEN'
    },
    update: {
      question: market.question,
      endDate: market.endDate ? new Date(market.endDate) : null,
      volume: market.volume || null,
      status: 'OPEN'
    }
  });
  
  // Create MarketSmartStats (only if not recently analyzed)
  await prisma.marketSmartStats.create({
    data: {
      marketId: market.id,
      smartCount: analysis.smartCount,
      smartWeighted: analysis.smartWeighted,
      smartShare: 0,
      smartScore: analysis.smartScore,
      topSmartTraders: analysis.topTraders, // TOP-10 with full data
      isPinned: false, // No pinned system
      priority: 0,     // No priority needed
      computedAt: new Date()
    }
  });
}

// ============================================================================
// FETCH EVENT: Get event data from Polymarket API
// ============================================================================

async function fetchEventByConditionId(conditionId: string): Promise<any> {
  try {
    // Try fetching by condition_id
    const eventRes = await fetch(`https://gamma-api.polymarket.com/events?id=${conditionId}`);
    if (eventRes.ok) {
      const events = await eventRes.json();
      if (events && events[0]) {
        return events[0];
      }
    }
  } catch (error) {
    logger.error(`Failed to fetch event for condition ${conditionId}`);
  }
  return null;
}

// ============================================================================
// ANALYZE EVENT: Analyze all outcomes in multi-outcome event
// ============================================================================

interface EventAnalysis {
  totalTraders: number;
  outcomesWithTraders: number;
  outcomes: Array<{
    marketId: string;
    question: string;
    price: number;
    traders: TraderPosition[];
  }>;
}

async function analyzeEvent(
  client: any,
  eventData: any,
  traders: Trader[]
): Promise<EventAnalysis> {
  
  const outcomes = [];
  let totalTradersSet = new Set<string>();
  
  // Filter out closed/settled markets
  const activeMarkets = (eventData.markets || []).filter((m: any) => {
    const isClosed = m.closed === true || m.closed === 'true';
    const isExpired = m.endDate && new Date(m.endDate) < new Date();
    return !isClosed && !isExpired;
  });
  
  logger.info(`   📊 Event has ${eventData.markets?.length || 0} total outcomes, ${activeMarkets.length} active`);
  
  // Analyze each outcome (market) in the event
  for (const market of activeMarkets.slice(0, 15)) { // Limit to 15 outcomes
    try {
      const analysis = await analyzeMarket(client, market, traders);
      
      if (analysis.smartCount > 0) {
        outcomes.push({
          marketId: market.id,
          question: market.question || market.groupItemTitle || 'Unknown',
          price: market.outcomePrices ? parseFloat(market.outcomePrices[0]) : 0.5,
          traders: analysis.topTraders
        });
        
        // Track unique traders across all outcomes
        analysis.topTraders.forEach(t => totalTradersSet.add(t.address));
      }
    } catch (error: any) {
      logger.error(`   ⚠️  Failed to analyze outcome ${market.id}: ${error.message}`);
    }
  }
  
  return {
    totalTraders: totalTradersSet.size,
    outcomesWithTraders: outcomes.length,
    outcomes
  };
}

// ============================================================================
// SAVE EVENT: Store event data as Alpha Market
// ============================================================================

async function saveEvent(eventData: any, analysis: EventAnalysis) {
  
  // Check if this event was recently analyzed
  const recentAnalysis = await prisma.marketSmartStats.findFirst({
    where: {
      marketId: eventData.slug || eventData.markets[0].id,
      computedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  });
  
  if (recentAnalysis) {
    const hoursAgo = Math.round((Date.now() - recentAnalysis.computedAt.getTime()) / 1000 / 60 / 60);
    logger.info(`      ⏭️  Skipping save - event analyzed ${hoursAgo}h ago`);
    return;
  }
  
  // Use event slug as market ID (or first market ID as fallback)
  const marketId = eventData.slug || eventData.markets[0].id;
  
  // Create/update Market record with event info
  await prisma.market.upsert({
    where: { id: marketId },
    create: {
      id: marketId,
      question: eventData.title,
      category: eventData.markets[0]?.category || 'Politics',
      slug: eventData.slug,
      eventSlug: eventData.slug,
      endDate: eventData.endDate ? new Date(eventData.endDate) : null,
      liquidity: parseFloat(eventData.liquidity || '0'),
      volume: parseFloat(eventData.volume || '0'),
      status: 'OPEN'
    },
    update: {
      question: eventData.title,
      eventSlug: eventData.slug,
      endDate: eventData.endDate ? new Date(eventData.endDate) : null,
      volume: parseFloat(eventData.volume || '0'),
      status: 'OPEN'
    }
  });
  
  // Calculate aggregate metrics
  const totalTraders = analysis.totalTraders;
  const totalWeighted = analysis.outcomes.reduce((sum, o) => {
    return sum + o.traders.reduce((tsum, t) => {
      const tierWeight = t.tier === 'S' ? 5 : t.tier === 'A' ? 3 : 1;
      return tsum + tierWeight;
    }, 0);
  }, 0);
  const smartScore = totalWeighted * Math.log(1 + (parseFloat(eventData.volume || '0')) / 1000000);
  
  // Format outcomes for storage as JSON
  const formattedOutcomes = analysis.outcomes.map(o => ({
    marketId: o.marketId,
    question: o.question,
    price: o.price,
    traders: o.traders.map(t => ({
      address: t.address,
      displayName: t.displayName,
      tier: t.tier,
      side: t.side,
      shares: t.shares,
      entryPrice: t.entryPrice
    }))
  }));
  
  // Create MarketSmartStats for event
  await prisma.marketSmartStats.create({
    data: {
      marketId: marketId,
      smartCount: totalTraders,
      smartWeighted: totalWeighted,
      smartShare: 0,
      smartScore: smartScore,
      topSmartTraders: formattedOutcomes as any, // Store ALL outcomes with traders as JSON!
      isPinned: false,
      priority: 0,
      computedAt: new Date()
    }
  });
}

// ============================================================================
// CLEANUP: Remove old market stats (keep only last 48 hours)
// ============================================================================

export async function cleanupOldMarkets() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const deleted = await prisma.marketSmartStats.deleteMany({
    where: {
      computedAt: { lt: cutoff }
    }
  });
  
  logger.info(`🧹 Cleaned up ${deleted.count} old market stats (>48h)`);
}
