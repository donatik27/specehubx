import { JobData } from '../lib/queue';
import { logger } from '../lib/logger';
import prisma from '@polymarket/database';
import { X_TRADERS_STATIC, getTwitterByAddress } from '@polymarket/shared';

export async function handleIngestionJob(data: JobData) {
  switch (data.type) {
    case 'sync-leaderboard':
      await syncLeaderboard(data.payload);
      break;
    case 'sync-markets':
      await syncMarkets(data.payload);
      break;
    case 'find-public-traders':
      await findPublicTraders(data.payload);
      break;
    case 'sync-public-traders':
      await syncPublicTraders(data.payload);
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

// Tier assignment function - Only S, A, B tiers
function assignTier(trader: any, leaderboard: any[], hasTwitter: boolean) {
  const rank = leaderboard.findIndex(t => t.proxyWallet === trader.proxyWallet) + 1;
  const totalTraders = leaderboard.length;
  const percentile = rank / totalTraders;
  
  // X-traders (with Twitter) get tier boost - minimum A-tier
  if (hasTwitter) {
    // Top 40% of X-traders are S-tier, rest are A-tier
    if (percentile <= 0.40) return 'S';
    return 'A'; // X-traders never below A
  }
  
  // Regular traders distribution
  if (percentile <= 0.35) return 'S';  // Top 35% = S-tier
  if (percentile <= 0.70) return 'A';  // Next 35% = A-tier
  return 'B';  // Bottom 30% = B-tier
}

// Calculate rarity score (max 1000 points)
function calculateRarityScore(
  pnl: number,
  volume: number,
  marketsTraded: number,
  rank: number,
  hasTwitter: boolean
): number {
  // PnL score (max 500 points) - $10M PnL = 500 points
  const pnlScore = Math.min(500, Math.max(0, (pnl / 10_000) * 500));
  
  // Volume score (max 300 points) - $50M volume = 300 points
  const volumeScore = Math.min(300, Math.max(0, (volume / 50_000) * 300));
  
  // Markets traded score (max 100 points) - 50 markets = 100 points
  const marketsScore = Math.min(100, Math.max(0, marketsTraded * 2));
  
  // Rank bonus (max 100 points) - #1 = 100 points, #1000 = 0 points
  const rankBonus = Math.min(100, Math.max(0, 100 - (rank / 10)));
  
  // Twitter bonus (50 points)
  const twitterBonus = hasTwitter ? 50 : 0;
  
  return Math.floor(pnlScore + volumeScore + marketsScore + rankBonus + twitterBonus);
}

async function syncLeaderboard(payload: any) {
  logger.info('🚀 Syncing leaderboard: TOP-1000 MONTH (regular traders)');
  
  try {
    const allTraders: any[] = [];
    const BATCH_SIZE = 100;
    const TOTAL_LIMIT = 1000;
    
    logger.info(`📥 Fetching top ${TOTAL_LIMIT} traders from MONTH leaderboard...`);
    
    for (let offset = 0; offset < TOTAL_LIMIT; offset += BATCH_SIZE) {
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?timePeriod=month&orderBy=PNL&limit=${BATCH_SIZE}&offset=${offset}`
      );
      
      if (!res.ok) {
        logger.error({ status: res.status }, 'Polymarket API error');
        break;
      }
      
      const batch = await res.json();
      
      if (batch.length === 0) {
        logger.info(`⚠️ Reached end of leaderboard at ${allTraders.length} traders`);
        break;
      }
      
      allTraders.push(...batch);
      logger.info(`✓ Fetched ${batch.length} traders (total: ${allTraders.length})`);
      
      // Small pause to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    logger.info(`✅ Fetched ${allTraders.length} traders from MONTH leaderboard`)
    
    // Assign tiers and save to DB
    logger.info('💾 Saving traders to database...');
    let saved = 0;
    
    // Save traders to DB (use profileImage from API, NOT profilePicture!)
    for (const t of allTraders) {
      if (!t.proxyWallet) continue;
      const address = t.proxyWallet.toLowerCase();
      
      try {
        // Leaderboard API returns 'profileImage', not 'profilePicture'
        const profilePic = t.profileImage || null;
        
        // Extract volume and markets_traded from API
        const volume = t.volume || 0;
        const marketsTraded = t.markets_traded || 0;
        const pnl = t.pnl || 0;
        
        // Check if this trader is in static X traders list (for twitterUsername)
        const staticTwitter = getTwitterByAddress(address);
        const hasTwitter = !!(staticTwitter || t.xUsername);
        
        // Calculate rank for this trader
        const rank = allTraders.findIndex(trader => trader.proxyWallet === t.proxyWallet) + 1;
        
        // Calculate tier and score using new system
        const tier = assignTier(t, allTraders, hasTwitter);
        const rarityScore = calculateRarityScore(pnl, volume, marketsTraded, rank, hasTwitter);
        
        // Calculate win rate (approximation)
        const winRate = marketsTraded > 0 && pnl > 0 && volume > 0
          ? Math.min(((pnl / volume) * 100), 100)
          : 0;
        
        // Build update object
        const updateData: any = {
          displayName: t.userName || undefined,
          profilePicture: profilePic || undefined,
          tier: tier,
          realizedPnl: pnl,
          totalPnl: pnl,
          tradeCount: marketsTraded,
          winRate: winRate,
          rarityScore: rarityScore,
          lastActiveAt: new Date(),
        };
        
        // Set twitterUsername from static list or API
        if (staticTwitter) {
          updateData.twitterUsername = staticTwitter;
        } else if (t.xUsername) {
          updateData.twitterUsername = t.xUsername;
        }
        
        await prisma.trader.upsert({
          where: { address },
          create: {
            address,
            displayName: t.userName || `${t.proxyWallet?.slice(0, 6)}...`,
            profilePicture: profilePic,
            twitterUsername: staticTwitter || t.xUsername || null,
            tier: tier,
            realizedPnl: pnl,
            totalPnl: pnl,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: rarityScore,
          },
          update: updateData,
        });
        saved++;
      } catch (error: any) {
        logger.error({ error: error.message, address: t.proxyWallet }, 'Failed to save trader');
      }
    }
    
    logger.info(`💾 Saved ${saved} traders to database`);
    
    // Count traders with/without profile pictures
    const withPics = allTraders.filter(t => t.profileImage).length;
    const withoutPics = allTraders.length - withPics;
    logger.info(`📸 Profile pictures: ${withPics} with images, ${withoutPics} without`);
    
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
    
    // 🗺️ ALWAYS update manually added locations (overwrite if needed)
    logger.info('🗺️  Updating manually added trader locations...');
    await updateManualLocations();
    
    // 🗺️ ONE-TIME: Add geolocation if not already done
    const tradersWithLocation = await prisma.trader.count({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
        ],
      },
    });
    
    logger.info(`📍 Traders with geolocation: ${tradersWithLocation}`);
    
    // If less than 50 traders have geolocation, run it once
    if (tradersWithLocation < 50) {
      logger.info('🗺️  Running one-time geolocation setup...');
      await addGeolocation();
    }
  } catch (error: any) {
    logger.error({ error: error.message }, 'Leaderboard sync failed');
    throw error;
  }
}

// Sync ALL static X traders (ensures they exist in DB even if not in top-1000 month)
async function syncStaticXTraders() {
  try {
    logger.info(`🔄 Syncing ${Object.keys(X_TRADERS_STATIC).length} static X traders...`);
    
    let created = 0;
    let updated = 0;
    let notFound = 0;
    
    // Fetch leaderboard ONLY for metadata (displayName, profilePicture)
    const leaderboardData = new Map<string, any>(); // address -> trader metadata
    
    logger.info('📥 Fetching leaderboard (for metadata only)...');
    try {
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?timePeriod=month&orderBy=PNL&limit=5000`
      );
      
      if (res.ok) {
        const traders = await res.json();
        for (const t of traders) {
          if (t.proxyWallet) {
            leaderboardData.set(t.proxyWallet.toLowerCase(), t);
          }
        }
        logger.info(`   ✓ Found ${traders.length} traders (for metadata)`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to fetch leaderboard');
    }
    
    logger.info('💾 Upserting static X traders with ALL-TIME PnL...');
    
    // Now upsert each static X trader
    for (const [twitterUsername, data] of Object.entries(X_TRADERS_STATIC)) {
      try {
        const address = data.address.toLowerCase();
        
        // Fetch ALL-TIME PnL via user-pnl-api (same as Polymarket uses)
        let allTimePnl = 0;
        try {
          const pnlRes = await fetch(
            `https://user-pnl-api.polymarket.com/user-pnl?user_address=${address}&interval=1m&fidelity=1d`
          );
          
          if (pnlRes.ok) {
            const pnlData = await pnlRes.json();
            // Get last (most recent) PnL value
            if (Array.isArray(pnlData) && pnlData.length > 0) {
              const latest = pnlData[pnlData.length - 1];
              allTimePnl = latest.p || 0;
            }
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          logger.error({ error: error.message, address }, 'Failed to fetch user-pnl');
        }
        
        // Get metadata from leaderboard if available
        const metadata = leaderboardData.get(address);
        
        const existing = await prisma.trader.findUnique({
          where: { address },
          select: { address: true },
        });
        
        // Prepare trader data
        const displayName = metadata?.userName || twitterUsername;
        const profilePicture = metadata?.profileImage || null;
        const volume = metadata?.volume || 0;
        const marketsTraded = metadata?.markets_traded || 0;
        const winRate = marketsTraded > 0 && volume > 0 && allTimePnl > 0 
          ? Math.min(((allTimePnl / volume) * 100), 100)
          : 0;
        
        await prisma.trader.upsert({
          where: { address },
          create: {
            address,
            displayName,
            profilePicture,
            twitterUsername: twitterUsername,
            tier: 'S',
            realizedPnl: allTimePnl,
            totalPnl: allTimePnl,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: calculateRarityScore(allTimePnl, volume, marketsTraded, 1, true), // NORMALIZED 0-1000
          },
          update: {
            displayName,
            profilePicture,
            twitterUsername: twitterUsername,
            tier: 'S',
            realizedPnl: allTimePnl,
            totalPnl: allTimePnl,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: calculateRarityScore(allTimePnl, volume, marketsTraded, 1, true), // NORMALIZED 0-1000
            lastActiveAt: new Date(),
          },
        });
        
        if (existing) {
          updated++;
          logger.info({ twitterUsername, allTimePnl: Math.floor(allTimePnl) }, '   ✅ Updated with ALL-TIME PnL');
        } else {
          created++;
          logger.info({ twitterUsername, allTimePnl: Math.floor(allTimePnl) }, '   ✨ Created with ALL-TIME PnL');
        }
        
      } catch (error: any) {
        logger.error({ error: error.message, twitterUsername }, '❌ Failed to sync trader');
      }
    }
    
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ STATIC X TRADERS SYNC COMPLETED (ALL-TIME PnL)!');
    logger.info(`   ✨ Created: ${created}`);
    logger.info(`   🔄 Updated: ${updated}`);
    logger.info(`   📊 Total X traders: ${Object.keys(X_TRADERS_STATIC).length}`);
    logger.info('   💰 Using /value endpoint for ALL-TIME PnL');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to sync static X traders');
  }
}

// Update PnL for ALL X traders (not just static, but ALL with twitterUsername)
async function syncAllXTradersPnl() {
  try {
    
    // Find ALL traders with twitterUsername (X traders)
    const allXTraders = await prisma.trader.findMany({
      where: {
        twitterUsername: { not: null },
      },
      select: {
        address: true,
        twitterUsername: true,
        displayName: true,
        totalPnl: true,
      },
    });
    
    logger.info(`🔄 Found ${allXTraders.length} X traders in DB, updating PnL & metadata...`);
    
    let updated = 0;
    let failed = 0;
    
    for (const trader of allXTraders) {
      try {
        const address = trader.address.toLowerCase();
        
        // Fetch profile info + PnL from Polymarket (single request!)
        let allTimePnl = trader.totalPnl ? Number(trader.totalPnl) : 0;
        let displayName = trader.displayName || trader.twitterUsername;
        let profilePicture: string | null = null;
        
        try {
          // Get profile info via leaderboard API with user param
          const profileRes = await fetch(
            `https://data-api.polymarket.com/v1/leaderboard?timePeriod=all&orderBy=VOL&limit=1&user=${address}`
          );
          
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (Array.isArray(profileData) && profileData.length > 0) {
              const profile = profileData[0];
              // Get Polymarket displayName and avatar
              displayName = profile.userName || displayName;
              profilePicture = profile.profileImage || null;
            }
          }
          
          // Get ALL-TIME PnL via user-pnl-api
          const pnlRes = await fetch(
            `https://user-pnl-api.polymarket.com/user-pnl?user_address=${address}&interval=1m&fidelity=1d`
          );
          
          if (pnlRes.ok) {
            const pnlData = await pnlRes.json();
            // Get last (most recent) PnL value
            if (Array.isArray(pnlData) && pnlData.length > 0) {
              const latest = pnlData[pnlData.length - 1];
              allTimePnl = latest.p || 0;
            }
          }
          
          // Rate limit (182 traders * 2 requests = 364 requests, 200ms = ~73 seconds)
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          logger.warn({ error: error.message, address }, 'Failed to fetch profile/pnl');
          failed++;
          continue;
        }
        
        // Update PnL + Polymarket metadata in DB
        await prisma.trader.update({
          where: { address },
          data: {
            displayName: displayName,
            profilePicture: profilePicture,
            realizedPnl: allTimePnl,
            totalPnl: allTimePnl,
            lastActiveAt: new Date(),
          },
        });
        
        updated++;
        
        if (updated % 10 === 0) {
          logger.info(`   ⏳ Progress: ${updated}/${allXTraders.length} traders updated...`);
        }
        
      } catch (error: any) {
        logger.error({ error: error.message, address: trader.address }, '❌ Failed to update trader PnL');
        failed++;
      }
    }
    
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✅ ALL X TRADERS PNL SYNC COMPLETED!');
    logger.info(`   🔄 Updated: ${updated}`);
    logger.info(`   ❌ Failed: ${failed}`);
    logger.info(`   📊 Total X traders: ${allXTraders.length}`);
    logger.info('   💰 Using user-pnl-api.polymarket.com');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to sync all X traders PnL');
  }
}

// Update manually added traders (always runs, overwrites existing locations)
async function updateManualLocations() {
  // Build map of traders with country from static X traders list
  const tradersWithCountry = Object.entries(X_TRADERS_STATIC)
    .filter(([_, data]) => data.country)
    .reduce((acc, [twitter, data]) => {
      acc[twitter] = data.country!;
      return acc;
    }, {} as Record<string, string>);

  // Fallback: Country centroids for countries not in CITY_COORDS
  const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
    'Europe': { lat: 50.0, lon: 10.0 },
    'Ireland': { lat: 53.4129, lon: -8.2439 },
    'Canada': { lat: 56.1304, lon: -106.3468 },
    'Australasia': { lat: -25.0, lon: 135.0 },
    'United States': { lat: 37.0902, lon: -95.7129 },
    'Germany': { lat: 51.1657, lon: 10.4515 },
    'Brazil': { lat: -14.2350, lon: -51.9253 },
    'Italy': { lat: 41.8719, lon: 12.5674 },
    'East Asia & Pacific': { lat: 35.0, lon: 105.0 },
    'Spain': { lat: 40.4637, lon: -3.7492 },
    'Australia': { lat: -25.2744, lon: 133.7751 },
    'Hong Kong': { lat: 22.3193, lon: 114.1694 },
    'United Kingdom': { lat: 55.3781, lon: -3.4360 },
    'Korea': { lat: 37.5665, lon: 126.9780 },
    'South Korea': { lat: 37.5665, lon: 126.9780 },
    'Japan': { lat: 36.2048, lon: 138.2529 },
    'Lithuania': { lat: 55.1694, lon: 23.8813 },
    'Denmark': { lat: 56.2639, lon: 9.5018 },
    'Sweden': { lat: 60.1282, lon: 18.6435 },
    'France': { lat: 46.2276, lon: 2.2137 },
    'Netherlands': { lat: 52.1326, lon: 5.2913 },
    'Poland': { lat: 51.9194, lon: 19.1451 },
    'Argentina': { lat: -38.4161, lon: -63.6167 },
    'Mexico': { lat: 23.6345, lon: -102.5528 },
    'Turkey': { lat: 38.9637, lon: 35.2433 },
    'South Africa': { lat: -30.5595, lon: 22.9375 },
    'India': { lat: 20.5937, lon: 78.9629 },
    'Vietnam': { lat: 14.0583, lon: 108.2772 },
    'Thailand': { lat: 15.8700, lon: 100.9925 },
    'Singapore': { lat: 1.3521, lon: 103.8198 },
    'Taiwan': { lat: 23.6978, lon: 120.9605 },
    'Philippines': { lat: 12.8797, lon: 121.7740 },
    'Indonesia': { lat: -0.7893, lon: 113.9213 },
    'Malaysia': { lat: 4.2105, lon: 101.9758 },
    'South Asia': { lat: 20.5937, lon: 78.9629 },
    'North America': { lat: 54.5260, lon: -105.2551 },
    'South America': { lat: -8.7832, lon: -55.4915 },
  };

  const CITY_COORDS: Record<string, { lat: number; lon: number; maxOffset: number }> = {
    US_CHICAGO: { lat: 41.8781, lon: -87.6298, maxOffset: 0.25 },
    US_DALLAS: { lat: 32.7767, lon: -96.7970, maxOffset: 0.25 },
    US_DENVER: { lat: 39.7392, lon: -104.9903, maxOffset: 0.25 },
    US_ATLANTA: { lat: 33.7490, lon: -84.3880, maxOffset: 0.25 },
    US_MINNEAPOLIS: { lat: 44.9778, lon: -93.2650, maxOffset: 0.25 },
    CA_TORONTO: { lat: 43.6532, lon: -79.3832, maxOffset: 0.2 },
    CA_MONTREAL: { lat: 45.5017, lon: -73.5673, maxOffset: 0.2 },
    CA_CALGARY: { lat: 51.0447, lon: -114.0719, maxOffset: 0.2 },
    BR_SAO_PAULO: { lat: -23.5505, lon: -46.6333, maxOffset: 0.2 },
    BR_BRASILIA: { lat: -15.7939, lon: -47.8828, maxOffset: 0.2 },
    AR_CORDOBA: { lat: -31.4201, lon: -64.1888, maxOffset: 0.2 },
    AR_ROSARIO: { lat: -32.9442, lon: -60.6505, maxOffset: 0.12 },
    CL_SANTIAGO: { lat: -33.4489, lon: -70.6693, maxOffset: 0.15 },
    MX_MEXICO_CITY: { lat: 19.4326, lon: -99.1332, maxOffset: 0.2 },
    MX_GUADALAJARA: { lat: 20.6597, lon: -103.3496, maxOffset: 0.2 },
    UK_BIRMINGHAM: { lat: 52.4862, lon: -1.8904, maxOffset: 0.15 },
    UK_MANCHESTER: { lat: 53.4808, lon: -2.2426, maxOffset: 0.15 },
    IE_ATHLONE: { lat: 53.4239, lon: -7.9407, maxOffset: 0.12 },
    ES_MADRID: { lat: 40.4168, lon: -3.7038, maxOffset: 0.15 },
    ES_ZARAGOZA: { lat: 41.6488, lon: -0.8891, maxOffset: 0.12 },
    FR_PARIS: { lat: 48.8566, lon: 2.3522, maxOffset: 0.15 },
    FR_LYON: { lat: 45.7640, lon: 4.8357, maxOffset: 0.15 },
    DE_BERLIN: { lat: 52.5200, lon: 13.4050, maxOffset: 0.15 },
    DE_MUNICH: { lat: 48.1351, lon: 11.5820, maxOffset: 0.15 },
    IT_ROME: { lat: 41.9028, lon: 12.4964, maxOffset: 0.15 },
    IT_MILAN: { lat: 45.4642, lon: 9.1900, maxOffset: 0.15 },
    NL_UTRECHT: { lat: 52.0907, lon: 5.1214, maxOffset: 0.1 },
    SE_UPPSALA: { lat: 59.8586, lon: 17.6389, maxOffset: 0.1 },
    DK_AARHUS: { lat: 56.1629, lon: 10.2039, maxOffset: 0.06 },
    AT_VIENNA: { lat: 48.2082, lon: 16.3738, maxOffset: 0.12 },
    PL_WARSAW: { lat: 52.2297, lon: 21.0122, maxOffset: 0.12 },
    CZ_PRAGUE: { lat: 50.0755, lon: 14.4378, maxOffset: 0.12 },
    UA_KYIV: { lat: 50.4501, lon: 30.5234, maxOffset: 0.12 },
    LT_VILNIUS: { lat: 54.6872, lon: 25.2797, maxOffset: 0.12 },
    EE_TALLINN: { lat: 59.4370, lon: 24.7536, maxOffset: 0.08 },
    HR_ZAGREB: { lat: 45.8150, lon: 15.9819, maxOffset: 0.12 },
    RO_BUCHAREST: { lat: 44.4268, lon: 26.1025, maxOffset: 0.12 },
    GR_LARISSA: { lat: 39.6390, lon: 22.4191, maxOffset: 0.1 },
    TR_ANKARA: { lat: 39.9334, lon: 32.8597, maxOffset: 0.12 },
    MA_RABAT: { lat: 34.0209, lon: -6.8416, maxOffset: 0.08 },
    AE_ABU_DHABI: { lat: 24.4539, lon: 54.3773, maxOffset: 0.05 },
    IL_JERUSALEM: { lat: 31.7683, lon: 35.2137, maxOffset: 0.08 },
    GE_TBILISI: { lat: 41.7151, lon: 44.8271, maxOffset: 0.12 },
    UZ_TASHKENT: { lat: 41.2995, lon: 69.2401, maxOffset: 0.12 },
    ZA_JOHANNESBURG: { lat: -26.2041, lon: 28.0473, maxOffset: 0.15 },
    IS_REYKJAVIK: { lat: 64.1466, lon: -21.9426, maxOffset: 0.02 },
    HK_SHENZHEN: { lat: 22.5431, lon: 114.0579, maxOffset: 0.06 },
    HK_GUANGZHOU: { lat: 23.1291, lon: 113.2644, maxOffset: 0.06 },
    TW_TAIPEI: { lat: 25.0330, lon: 121.5654, maxOffset: 0.02 },
    JP_TOKYO: { lat: 35.6762, lon: 139.6503, maxOffset: 0.02 },
    JP_NAGOYA: { lat: 35.1815, lon: 136.9066, maxOffset: 0.12 },
    KR_SEOUL: { lat: 37.5665, lon: 126.9780, maxOffset: 0.03 },
    KR_BUSAN: { lat: 35.1796, lon: 129.0756, maxOffset: 0.03 },
    VN_HANOI: { lat: 21.0278, lon: 105.8342, maxOffset: 0.08 },
    TH_BANGKOK: { lat: 13.7563, lon: 100.5018, maxOffset: 0.05 },
    ID_BANDUNG: { lat: -6.9175, lon: 107.6191, maxOffset: 0.1 },
    MY_KUALA_LUMPUR: { lat: 3.1390, lon: 101.6869, maxOffset: 0.05 },
    PH_QUEZON: { lat: 14.6760, lon: 121.0437, maxOffset: 0.05 },
    IN_DELHI: { lat: 28.6139, lon: 77.2090, maxOffset: 0.15 },
    IN_PUNE: { lat: 18.5204, lon: 73.8567, maxOffset: 0.12 },
    IN_BANGALORE: { lat: 12.9716, lon: 77.5946, maxOffset: 0.15 },
    CAR_SANTO_DOMINGO: { lat: 18.4861, lon: -69.9312, maxOffset: 0.02 },
    EC_QUITO: { lat: -0.1807, lon: -78.4678, maxOffset: 0.08 },
    AU_CANBERRA: { lat: -35.2809, lon: 149.1300, maxOffset: 0.15 },
    AU_MELBOURNE: { lat: -37.8136, lon: 144.9631, maxOffset: 0.05 },
  };

  const COUNTRY_CITY_POOLS: Record<string, string[]> = {
    'United States': ['US_CHICAGO', 'US_DALLAS', 'US_DENVER', 'US_ATLANTA', 'US_MINNEAPOLIS'],
    'Canada': ['CA_TORONTO', 'CA_MONTREAL', 'CA_CALGARY'],
    'Brazil': ['BR_SAO_PAULO', 'BR_BRASILIA'],
    'Argentina': ['AR_CORDOBA', 'AR_ROSARIO'],
    'Chile': ['CL_SANTIAGO'],
    'Mexico': ['MX_MEXICO_CITY', 'MX_GUADALAJARA'],
    'United Kingdom': ['UK_BIRMINGHAM', 'UK_MANCHESTER'],
    'Ireland': ['IE_ATHLONE'],
    'Spain': ['ES_MADRID', 'ES_ZARAGOZA'],
    'France': ['FR_PARIS', 'FR_LYON'],
    'Germany': ['DE_BERLIN', 'DE_MUNICH'],
    'Italy': ['IT_ROME', 'IT_MILAN'],
    'Netherlands': ['NL_UTRECHT'],
    'Sweden': ['SE_UPPSALA'],
    'Denmark': ['DK_AARHUS'],
    'Austria': ['AT_VIENNA'],
    'Poland': ['PL_WARSAW'],
    'Czech Republic': ['CZ_PRAGUE'],
    'Ukraine': ['UA_KYIV'],
    'Lithuania': ['LT_VILNIUS'],
    'Estonia': ['EE_TALLINN'],
    'Croatia': ['HR_ZAGREB'],
    'Romania': ['RO_BUCHAREST'],
    'Greece': ['GR_LARISSA'],
    'Turkey': ['TR_ANKARA'],
    'Morocco': ['MA_RABAT'],
    'United Arab Emirates': ['AE_ABU_DHABI'],
    'Israel': ['IL_JERUSALEM'],
    'Georgia': ['GE_TBILISI'],
    'Uzbekistan': ['UZ_TASHKENT'],
    'South Africa': ['ZA_JOHANNESBURG'],
    'Iceland': ['IS_REYKJAVIK'],
    'Hong Kong': ['HK_SHENZHEN', 'HK_GUANGZHOU'],
    'Taiwan': ['TW_TAIPEI'],
    'Japan': ['JP_TOKYO', 'JP_NAGOYA'],
    'Korea': ['KR_SEOUL', 'KR_BUSAN'],
    'South Korea': ['KR_SEOUL', 'KR_BUSAN'],
    'Vietnam': ['VN_HANOI'],
    'Thailand': ['TH_BANGKOK'],
    'Indonesia': ['ID_BANDUNG'],
    'Malaysia': ['MY_KUALA_LUMPUR'],
    'Philippines': ['PH_QUEZON'],
    'India': ['IN_DELHI', 'IN_PUNE', 'IN_BANGALORE'],
    'Caribbean': ['CAR_SANTO_DOMINGO'],
    'Ecuador': ['EC_QUITO'],
    'Australasia': ['AU_CANBERRA', 'AU_MELBOURNE'],
    'Australia': ['AU_CANBERRA', 'AU_MELBOURNE'],
    'Europe': ['DE_BERLIN', 'FR_PARIS', 'IT_ROME', 'ES_MADRID', 'AT_VIENNA'],
    'East Asia & Pacific': ['JP_TOKYO', 'KR_SEOUL', 'TW_TAIPEI', 'HK_SHENZHEN'],
    'South Asia': ['IN_DELHI', 'IN_PUNE', 'IN_BANGALORE'],
    'North America': ['US_CHICAGO', 'US_DALLAS', 'CA_TORONTO'],
    'South America': ['BR_SAO_PAULO', 'AR_ROSARIO', 'CL_SANTIAGO'],
  };

  try {
    logger.info(`🔄 Updating ${Object.keys(tradersWithCountry).length} manually added traders with geolocation...`);
    
    const hashString = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) % 1000000;
      }
      return hash;
    };

    const getGridOffset = (index: number, total: number, maxOffset: number) => {
      if (total <= 1 || maxOffset <= 0) {
        return { latOffset: 0, lonOffset: 0 };
      }

      const gridSize = Math.ceil(Math.sqrt(total));
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const span = maxOffset * 2;
      const step = gridSize > 1 ? span / (gridSize - 1) : 0;
      const center = (gridSize - 1) / 2;

      return {
        latOffset: (row - center) * step,
        lonOffset: (col - center) * step,
      };
    };

    // Deterministic city assignment + per-city spread (avoids overlap in dense regions)
    const assignedCity: Record<string, string> = {};
    const assignedIndex: Record<string, number> = {};
    const cityBuckets: Record<string, string[]> = {};

    const sortedUsers = Object.keys(tradersWithCountry).sort((a, b) => a.localeCompare(b));
    for (const twitterUsername of sortedUsers) {
      const country = tradersWithCountry[twitterUsername];
      const cityPool = COUNTRY_CITY_POOLS[country];
      
      // If country not in CITY_COORDS pools, use COUNTRY_CENTROIDS fallback (old system)
      if (!cityPool || cityPool.length === 0) {
        const centroid = COUNTRY_CENTROIDS[country];
        if (centroid) {
          // Use old system: country centroid + small deterministic offset
          const seed = hashString(twitterUsername.toLowerCase());
          const angle = (seed % 360) * (Math.PI / 180);
          const distance = ((seed % 100) / 100) * 0.5; // Max 0.5 degrees offset
          
          const lat = centroid.lat + distance * Math.cos(angle);
          const lon = centroid.lon + distance * Math.sin(angle);
          
          await prisma.trader.updateMany({
            where: { twitterUsername },
            data: {
              latitude: lat,
              longitude: lon,
              country: country,
            },
          });
          
          logger.info({ twitterUsername, country, lat, lon }, `✓ Updated using country centroid (fallback)`);
          continue; // Skip to next trader
        } else {
          // Ultimate fallback - skip trader with warning
          logger.warn({ country, twitterUsername }, `⚠️ Country not found in any coordinate system, skipping`);
          continue;
        }
      }

      const seed = hashString(twitterUsername.toLowerCase());
      const cityKey = cityPool[seed % cityPool.length];
      const bucketKey = `${country}::${cityKey}`;

      if (!cityBuckets[bucketKey]) {
        cityBuckets[bucketKey] = [];
      }

      assignedCity[twitterUsername] = cityKey;
      assignedIndex[twitterUsername] = cityBuckets[bucketKey].length;
      cityBuckets[bucketKey].push(twitterUsername);
    }

    let updated = 0;
    for (const [twitterUsername, country] of Object.entries(tradersWithCountry)) {
      const cityKey = assignedCity[twitterUsername];
      if (!cityKey) {
        logger.warn({ twitterUsername, country }, 'City pool not found');
        continue;
      }

      const bucketKey = `${country}::${cityKey}`;
      const bucket = cityBuckets[bucketKey] || [];
      const indexInBucket = assignedIndex[twitterUsername] ?? 0;
      const city = CITY_COORDS[cityKey];
      if (!city) {
        logger.warn({ twitterUsername, country, cityKey }, 'City coords not found');
        continue;
      }

      // Deterministic grid spread: avoids overlap while staying on land
      const { latOffset, lonOffset } = getGridOffset(indexInBucket, bucket.length, city.maxOffset);

      const result = await prisma.trader.updateMany({
        where: { twitterUsername },
        data: {
          latitude: city.lat + latOffset,
          longitude: city.lon + lonOffset,
          country: country,
          tier: 'S', // Manual traders are S-tier
        },
      });

      if (result.count > 0) {
        logger.info({ twitterUsername, country, updated: result.count }, '✅ Updated');
        updated += result.count;
      }
    }

    logger.info(`✅ Manual locations updated: ${updated} traders`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to update manual locations');
  }
}

// Geolocation logic (runs once when needed)
async function addGeolocation() {
  const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
    'Germany': { lat: 51.1657, lon: 10.4515 },
    'Europe': { lat: 50.0, lon: 10.0 },
    'Brazil': { lat: -14.2350, lon: -51.9253 },
    'Italy': { lat: 41.8719, lon: 12.5674 },
    'East Asia & Pacific': { lat: 35.0, lon: 105.0 },
    'United States': { lat: 37.0902, lon: -95.7129 },
    'Spain': { lat: 40.4637, lon: -3.7492 },
    'Australasia': { lat: -25.0, lon: 135.0 },
    'Australia': { lat: -25.2744, lon: 133.7751 },
    'Hong Kong': { lat: 22.3193, lon: 114.1694 },
    'United Kingdom': { lat: 55.3781, lon: -3.4360 },
    'Korea': { lat: 37.5665, lon: 126.9780 },
    'Japan': { lat: 36.2048, lon: 138.2529 },
    'Lithuania': { lat: 55.1694, lon: 23.8813 },
    'Canada': { lat: 56.1304, lon: -106.3468 },
    'Denmark': { lat: 56.2639, lon: 9.5018 },
    'Thailand': { lat: 15.8700, lon: 100.9925 },
    'Slovakia': { lat: 48.6690, lon: 19.6990 },
    'Morocco': { lat: 31.7917, lon: -7.0926 },
    'Estonia': { lat: 58.5953, lon: 25.0136 },
    'Turkey': { lat: 38.9637, lon: 35.2433 },
    'Indonesia': { lat: -0.7893, lon: 113.9213 },
    'West Asia': { lat: 29.0, lon: 53.0 },
    'Poland': { lat: 51.9194, lon: 19.1451 },
    'Austria': { lat: 47.5162, lon: 14.5501 },
    'North America': { lat: 54.5260, lon: -105.2551 },
    'Netherlands': { lat: 52.1326, lon: 5.2913 },
    'Ireland': { lat: 53.4129, lon: -8.2439 },
  };

  const TRADER_LOCATIONS: Record<string, string> = {
    '0xTactic': 'Germany',
    '0xTrinity': 'Europe',
    'Domahhhh': 'Ireland',
    'failstonerPM': 'Canada',
    'BitalikWuterin': 'Australasia',
    'Foster': 'United States',
    'AbrahamKurland': 'Brazil',
    'AnjunPoly': 'Italy',
    'AnselFang': 'East Asia & Pacific',
    'BeneGesseritPM': 'United States',
    'Betwick1': 'Spain',
    'BitalikWuterin': 'Australasia',
    'BrokieTrades': 'United States',
    'CUTNPASTE4': 'Australia',
    'Cabronidus': 'Spain',
    'CarOnPolymarket': 'Europe',
    'ColeBartiromo': 'United States',
    'Domahhhh': 'Ireland',
    'Dyor_0x': 'United Kingdom',
    'Eltonma': 'Hong Kong',
    'EricZhu06': 'United States',
    'Ferzinhagianola': 'United Kingdom',
    'Foster': 'United States',
    'HanRiverVictim': 'Korea',
    'HarveyMackinto2': 'Japan',
    'IceFrosst': 'Lithuania',
    'Impij25': 'Canada',
    'IqDegen': 'Germany',
    'JJo3999': 'Australia',
    'Junk3383': 'Korea',
    'LegenTrader86': 'Hong Kong',
    'MiSTkyGo': 'Europe',
    'MrOziPM': 'Denmark',
    'ParkDae_gangnam': 'Thailand',
    'PatroclusPoly': 'Canada',
    'SnoorrrasonPoly': 'Slovakia',
    'UjxTCY7Z7ftjiNq': 'Korea',
    'XPredicter': 'Morocco',
    'biancalianne418': 'Japan',
    'bitcoinzhang1': 'Japan',
    'cripes3': 'Spain',
    'cynical_reason': 'Estonia',
    'debased_PM': 'Turkey',
    'denizz_poly': 'Indonesia',
    'drewlivanos': 'United States',
    'dw8998': 'East Asia & Pacific',
    'evan_semet': 'United States',
    'feverpromotions': 'Japan',
    'fortaellinger': 'West Asia',
    'holy_moses7': 'West Asia',
    'hypsterlo': 'Poland',
    'johnleftman': 'United States',
    'jongpatori': 'Korea',
    'joselebetis2': 'Australia',
    'love_u_4ever': 'Hong Kong',
    'one8tyfive': 'Austria',
    'smdx_btc': 'United States',
    'tulipking': 'North America',
    'vacoolaaaa': 'Netherlands',
    'videlake': 'Hong Kong',
    'wkmfa57': 'Hong Kong',
  };

  try {
    const traders = await prisma.trader.findMany({
      where: {
        twitterUsername: { not: null },
        latitude: null, // Only update those without location
      },
      select: {
        address: true,
        twitterUsername: true,
      },
    });

    logger.info(`🗺️  Found ${traders.length} traders needing geolocation`);

    let updated = 0;
    for (const trader of traders) {
      if (!trader.twitterUsername) continue;

      const location = TRADER_LOCATIONS[trader.twitterUsername];
      if (!location) continue;

      const coords = LOCATION_COORDS[location];
      if (!coords) continue;

      // Add small random offset to avoid exact overlap
      const latOffset = (Math.random() - 0.5) * 2;
      const lonOffset = (Math.random() - 0.5) * 2;

      await prisma.trader.update({
        where: { address: trader.address },
        data: {
          latitude: coords.lat + latOffset,
          longitude: coords.lon + lonOffset,
          country: location,
        },
      });

      updated++;
    }

    logger.info(`✅ Geolocation complete! Updated ${updated} traders`);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Geolocation failed');
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

async function findPublicTraders(payload: any) {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔍 FINDING TOP-150 PUBLIC TRADERS (with Twitter)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const publicTradersMap = new Map<string, any>(); // address -> trader data
    const MAX_TRADERS = 150;
    
    // Search periods in order of priority: month > week > day
    const periods = ['month', 'week', 'day'];
    
    for (const period of periods) {
      if (publicTradersMap.size >= MAX_TRADERS) break;
      
      logger.info(`📥 Fetching from ${period.toUpperCase()} leaderboard...`);
      
      const res = await fetch(
        `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=1000`
      );
      
      if (!res.ok) {
        logger.error({ status: res.status, period }, 'API error');
        continue;
      }
      
      const traders = await res.json();
      
      // Filter: only traders with Twitter (xUsername)
      const withTwitter = traders.filter((t: any) => t.xUsername && t.proxyWallet);
      
      logger.info(`   Found ${withTwitter.length} traders with Twitter in ${period}`);
      
      // Add to map (deduplicate by address)
      for (const t of withTwitter) {
        if (publicTradersMap.size >= MAX_TRADERS) break;
        
        if (!publicTradersMap.has(t.proxyWallet)) {
          publicTradersMap.set(t.proxyWallet, t);
        }
      }
      
      logger.info(`   ✓ Total unique: ${publicTradersMap.size}/${MAX_TRADERS}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const publicTraders = Array.from(publicTradersMap.values());
    
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`✅ FOUND ${publicTraders.length} PUBLIC TRADERS`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');
    logger.info('📋 TWITTER HANDLES LIST (copy this to give locations):');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Sort by PnL (highest first)
    publicTraders.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
    
    for (let i = 0; i < publicTraders.length; i++) {
      const t = publicTraders[i];
      const pnl = (t.pnl / 1000).toFixed(1);
      logger.info(`${i + 1}. @${t.xUsername} | ${t.userName || 'Unknown'} | $${pnl}K | ${t.proxyWallet}`);
    }
    
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('');
    logger.info('📝 NEXT STEP:');
    logger.info('   1. Copy this list');
    logger.info('   2. Manually check locations for each trader');
    logger.info('   3. Send back list with locations');
    logger.info('   4. We will add them to the map!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to find public traders');
    throw error;
  }
}

async function fetchAllTimePnlFromProfile(address: string): Promise<number | null> {
  try {
    const pnlRes = await fetch(
      `https://user-pnl-api.polymarket.com/user-pnl?user_address=${address}&interval=1m&fidelity=1d`
    );

    if (!pnlRes.ok) {
      return null;
    }

    const pnlData = await pnlRes.json();
    if (Array.isArray(pnlData) && pnlData.length > 0) {
      const latest = pnlData[pnlData.length - 1];
      return latest?.p ?? null;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function syncPublicTraders(payload: any) {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🎯 SYNCING PUBLIC TRADERS (Media X Leaderboard)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const publicTradersMap = new Map<string, any>();
    const MAX_TRADERS = 200;
    
    // Fetch from DAILY, WEEKLY and MONTHLY leaderboards
    const periods = ['day', 'week', 'month'];
    
    for (const period of periods) {
      logger.info(`📥 Fetching top-1000 from ${period.toUpperCase()} leaderboard...`);
      
      // Fetch in batches of 100 (API limit per request)
      const BATCH_SIZE = 100;
      const TOTAL_LIMIT = 1000;
      
      for (let offset = 0; offset < TOTAL_LIMIT; offset += BATCH_SIZE) {
        const res = await fetch(
          `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=${BATCH_SIZE}&offset=${offset}`
        );
        
        if (!res.ok) {
          logger.error({ status: res.status, period, offset }, 'API error');
          break;
        }
        
        const traders = await res.json();
        
        if (traders.length === 0) {
          logger.info(`   ⚠️ Reached end at offset ${offset}`);
          break;
        }
        
        // Filter: only traders with Twitter (xUsername) and trim whitespace
        const withTwitter = traders.filter((t: any) => t.xUsername && t.xUsername.trim() && t.proxyWallet);
        
        // Add to map (deduplicate by address, keep highest PnL)
        for (const t of withTwitter) {
          const existing = publicTradersMap.get(t.proxyWallet);
          
          if (!existing || (t.pnl || 0) > (existing.pnl || 0)) {
            publicTradersMap.set(t.proxyWallet, {
              ...t,
              period, // Track which period had the best PnL
            });
          }
        }
        
        logger.info(`   ✓ Batch ${offset}-${offset + BATCH_SIZE}: ${withTwitter.length} with Twitter | Total: ${publicTradersMap.size}`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      logger.info(`   ✅ ${period.toUpperCase()} complete: ${publicTradersMap.size} unique traders`);
      logger.info('');
    }
    
    // Convert to array and sort by PnL (highest first)
    let publicTraders = Array.from(publicTradersMap.values());
    publicTraders.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
    
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`✅ FOUND ${publicTraders.length} PUBLIC TRADERS TOTAL`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('💾 Saving to database...');
    
    let saved = 0;
    let updated = 0;
    
    for (const t of publicTraders) {
      if (!t.proxyWallet) continue;
      
      try {
        const address = t.proxyWallet.toLowerCase();
        const profilePic = t.profileImage || null;
        const volume = t.volume || 0;
        const marketsTraded = t.markets_traded || 0;
        let allTimePnl = t.pnl || 0;

        // Pull all-time PnL directly from profile API (most accurate)
        const profilePnl = await fetchAllTimePnlFromProfile(address);
        if (typeof profilePnl === 'number' && !Number.isNaN(profilePnl)) {
          allTimePnl = profilePnl;
        }
        // Gentle rate limit for profile PnL API
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Calculate win rate (approximation based on PnL and volume)
        let winRate = 0.5; // Default 50%
        if (volume > 0 && allTimePnl) {
          const estimatedWins = Math.max(0, Math.min(1, 0.5 + (allTimePnl / volume) * 0.5));
          winRate = estimatedWins;
        }
        
        // Assign tier based on ranking
        const rank = publicTraders.findIndex(trader => trader.proxyWallet === t.proxyWallet) + 1;
        
        // Calculate NORMALIZED rarity score 0-1000 (same system for all!)
        const hasTwitter = !!(t.xUsername);
        const rarityScore = calculateRarityScore(allTimePnl || 0, volume, marketsTraded, rank, hasTwitter);
        let tier = 'B';
        if (rank <= 20) tier = 'S'; // Top 20 = S tier
        else if (rank <= 80) tier = 'A'; // Top 80 = A tier
        else tier = 'B'; // Rest = B tier
        
        const traderData = {
          address,
          displayName: t.userName || t.xUsername || null,
          profilePicture: profilePic,
          twitterUsername: t.xUsername || null,
          tier: tier,
          rarityScore: rarityScore,
          realizedPnl: allTimePnl || 0,
          totalPnl: allTimePnl || 0,
          winRate: winRate,
          tradeCount: marketsTraded,
          lastActiveAt: new Date(),
          // NO COORDINATES YET (will be added manually later)
          latitude: null,
          longitude: null,
          country: null,
        };
        
        // Upsert trader (create or update)
        const result = await prisma.trader.upsert({
          where: { address: traderData.address },
          create: traderData,
          update: {
            displayName: traderData.displayName,
            profilePicture: traderData.profilePicture,
            twitterUsername: traderData.twitterUsername,
            tier: traderData.tier,
            rarityScore: traderData.rarityScore,
            realizedPnl: traderData.realizedPnl,
            totalPnl: traderData.totalPnl,
            winRate: traderData.winRate,
            tradeCount: traderData.tradeCount,
            lastActiveAt: traderData.lastActiveAt,
          },
        });
        
        if (result) {
          const isNew = !result.createdAt || (new Date().getTime() - new Date(result.createdAt).getTime()) < 1000;
          if (isNew) saved++;
          else updated++;
        }
        
      } catch (error: any) {
        logger.error({ address: t.proxyWallet, error: error.message }, 'Failed to save trader');
      }
    }
    
    logger.info('');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`✅ PUBLIC TRADERS SYNC COMPLETED!`);
    logger.info(`   📊 Total processed: ${publicTraders.length}`);
    logger.info(`   ✨ New traders: ${saved}`);
    logger.info(`   🔄 Updated traders: ${updated}`);
    logger.info('   ✅ Traders are now visible in X (Media) tab!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Failed to sync public traders');
    throw error;
  }
}
