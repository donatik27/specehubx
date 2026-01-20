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
  logger.info('🚀 Syncing leaderboard: TOP-1000 MONTH ONLY');
  
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
            rarityScore: Math.floor(allTimePnl + (volume * 0.1)),
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
            rarityScore: Math.floor(allTimePnl + (volume * 0.1)),
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

  const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
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
    'Ukraine': { lat: 48.3794, lon: 31.1656 },
    'Malaysia': { lat: 4.2105, lon: 101.9758 },
    'Chile': { lat: -35.6751, lon: -71.5430 },
    'United Arab Emirates': { lat: 23.4241, lon: 53.8478 },
    'Czech Republic': { lat: 49.8175, lon: 15.4730 },
    'Ecuador': { lat: -1.8312, lon: -78.1834 },
    'Uzbekistan': { lat: 41.3775, lon: 64.5853 },
    'Taiwan': { lat: 23.6978, lon: 120.9605 },
    'Singapore': { lat: 1.3521, lon: 103.8198 },
    'France': { lat: 46.2276, lon: 2.2137 },
    'Argentina': { lat: -38.4161, lon: -63.6167 },
    'India': { lat: 20.5937, lon: 78.9629 },
    'Croatia': { lat: 45.1, lon: 15.2 },
    'South Asia': { lat: 20.0, lon: 77.0 },
    'Eastern Europe (Non-EU)': { lat: 50.0, lon: 30.0 },
    'China': { lat: 35.8617, lon: 104.1954 },
    'Philippines': { lat: 12.8797, lon: 121.7740 },
    'Norway': { lat: 60.4720, lon: 8.4689 },
    'Israel': { lat: 31.0461, lon: 34.8516 },
    'Romania': { lat: 45.9432, lon: 24.9668 },
    'Vietnam': { lat: 14.0583, lon: 108.2772 },
    'Greece': { lat: 39.0742, lon: 21.8243 },
    'South Africa': { lat: -30.5595, lon: 22.9375 },
    'South America': { lat: -8.7832, lon: -55.4915 },
    'Iceland': { lat: 64.9631, lon: -19.0208 },
    'Georgia': { lat: 42.3154, lon: 43.3569 },
    'Sweden': { lat: 60.1282, lon: 18.6435 },
  };

  try {
    logger.info(`🔄 Updating ${Object.keys(tradersWithCountry).length} manually added traders with geolocation...`);
    
    let updated = 0;
    for (const [twitterUsername, country] of Object.entries(tradersWithCountry)) {
      const coords = LOCATION_COORDS[country];
      if (!coords) {
        logger.warn({ twitterUsername, country }, 'Country coords not found');
        continue;
      }

      // Smart jitter: bigger offset for popular countries
      // Count traders in this country
      const tradersInCountry = Object.values(tradersWithCountry).filter(c => c === country).length;
      
      // Calculate offset based on trader density
      let offsetMultiplier = 2; // default ±1°
      if (tradersInCountry >= 10) offsetMultiplier = 12; // ±6° for 10+ traders
      else if (tradersInCountry >= 5) offsetMultiplier = 8; // ±4° for 5-9 traders
      else if (tradersInCountry >= 3) offsetMultiplier = 5; // ±2.5° for 3-4 traders
      
      const latOffset = (Math.random() - 0.5) * offsetMultiplier;
      const lonOffset = (Math.random() - 0.5) * offsetMultiplier;

      const result = await prisma.trader.updateMany({
        where: { twitterUsername },
        data: {
          latitude: coords.lat + latOffset,
          longitude: coords.lon + lonOffset,
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
        const profilePic = t.profileImage || null;
        const volume = t.volume || 0;
        const marketsTraded = t.markets_traded || 0;
        
        // Calculate win rate (approximation based on PnL and volume)
        let winRate = 0.5; // Default 50%
        if (volume > 0 && t.pnl) {
          const estimatedWins = Math.max(0, Math.min(1, 0.5 + (t.pnl / volume) * 0.5));
          winRate = estimatedWins;
        }
        
        // Calculate rarity score based on PnL and volume
        const pnlScore = Math.max(0, (t.pnl || 0) / 1000); // $1K = 1 point
        const volumeScore = Math.max(0, volume / 10000); // $10K volume = 1 point
        const rarityScore = Math.floor(pnlScore + volumeScore);
        
        // Assign tier based on ranking
        const rank = publicTraders.findIndex(trader => trader.proxyWallet === t.proxyWallet) + 1;
        let tier = 'B';
        if (rank <= 20) tier = 'S'; // Top 20 = S tier
        else if (rank <= 80) tier = 'A'; // Top 80 = A tier
        else tier = 'B'; // Rest = B tier
        
        const traderData = {
          address: t.proxyWallet.toLowerCase(),
          displayName: t.userName || t.xUsername || null,
          profilePicture: profilePic,
          twitterUsername: t.xUsername || null,
          tier: tier,
          rarityScore: rarityScore,
          realizedPnl: t.pnl || 0,
          totalPnl: t.pnl || 0,
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
