import 'dotenv/config';
import prisma from '@polymarket/database';
import { logger } from './lib/logger';

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔧 FIXING TWITTER TRADERS WITH DEFAULT PNL ($25K)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Find all traders with Twitter but default PnL (25000)
  const tradersToFix = await prisma.trader.findMany({
    where: {
      twitterUsername: { not: null },
      totalPnl: 25000, // Default value = not found
    },
  });
  
  logger.info(`📊 Found ${tradersToFix.length} traders with Twitter but default PnL`);
  logger.info('');
  
  if (tradersToFix.length === 0) {
    logger.info('✅ No traders to fix!');
    await prisma.$disconnect();
    return;
  }
  
  let fixed = 0;
  let notFound = 0;
  
  for (const trader of tradersToFix) {
    const username = trader.twitterUsername!;
    logger.info(`🔍 Searching for @${username}...`);
    
    try {
      // Try Polymarket Profile API first
      const usernameVariants = [
        username,
        username.replace('@', ''),
        `@${username}`,
      ];
      
      let foundData: any = null;
      
      // Try Profile API
      for (const variant of usernameVariants) {
        try {
          const profileRes = await fetch(
            `https://gamma-api.polymarket.com/profile/twitter/${variant}`
          );
          
          if (profileRes.ok) {
            const profile = await profileRes.json();
            if (profile.address) {
              foundData = profile;
              logger.info(`   ✓ Found via Profile API: ${profile.address}`);
              break;
            }
          }
        } catch (e) {
          // Try next variant
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // If found address, fetch leaderboard data
      if (foundData?.address) {
        logger.info(`   → Fetching leaderboard data...`);
        
        for (const period of ['month', 'week', 'all', 'day']) {
          const leaderboardRes = await fetch(
            `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=1000`
          );
          
          if (leaderboardRes.ok) {
            const traders = await leaderboardRes.json();
            const leaderboardData = traders.find((t: any) => 
              t.proxyWallet?.toLowerCase() === foundData.address.toLowerCase()
            );
            
            if (leaderboardData) {
              foundData = { ...foundData, ...leaderboardData };
              logger.info(`   ✓ Found leaderboard data in ${period}`);
              break;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // If still no data, search leaderboards by Twitter username
      if (!foundData) {
        logger.info(`   → Searching leaderboards...`);
        
        const normalizeUsername = (u: string) => u.replace('@', '').trim().toLowerCase();
        const normalizedUsername = normalizeUsername(username);
        
        for (const period of ['month', 'week', 'all', 'day']) {
          const leaderboardRes = await fetch(
            `https://data-api.polymarket.com/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=1000`
          );
          
          if (leaderboardRes.ok) {
            const traders = await leaderboardRes.json();
            
            const found = traders.find((t: any) => {
              if (!t.xUsername) return false;
              return normalizeUsername(t.xUsername) === normalizedUsername ||
                     normalizeUsername(t.userName || '') === normalizedUsername;
            });
            
            if (found) {
              foundData = found;
              logger.info(`   ✓ Found in ${period} leaderboard`);
              break;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Update if found
      if (foundData && foundData.pnl && foundData.pnl !== 25000) {
        const pnl = foundData.pnl || 25000;
        const volume = foundData.volume || 0;
        const marketsTraded = foundData.markets_traded || 10;
        const winRate = marketsTraded > 0 && pnl > 0 
          ? Math.min(((pnl / (volume || pnl)) * 100), 75)
          : 50;
        
        // Determine tier based on PnL
        let tier = 'B';
        if (pnl > 100000 || foundData.xUsername) tier = 'S';
        else if (pnl > 50000) tier = 'A';
        
        await prisma.trader.update({
          where: { address: trader.address },
          data: {
            totalPnl: pnl,
            realizedPnl: pnl,
            profilePicture: foundData.profileImage || trader.profilePicture,
            displayName: foundData.userName || trader.displayName,
            tier: tier as any,
            tradeCount: marketsTraded,
            winRate: winRate,
            rarityScore: Math.floor(pnl + (volume * 0.1)),
          },
        });
        
        logger.info(`   ✅ FIXED: @${username} → PnL: $${(pnl / 1000).toFixed(1)}K, Tier: ${tier}`);
        fixed++;
      } else {
        logger.warn(`   ❌ NOT FOUND: @${username} (keeping default)`);
        notFound++;
      }
      
    } catch (error: any) {
      logger.error({ error: error.message, username }, '   ❌ Error processing trader');
      notFound++;
    }
    
    // Delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('✅ FIX COMPLETE!');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`📊 Results:`);
  logger.info(`   ✅ Fixed: ${fixed} traders`);
  logger.info(`   ❌ Not found: ${notFound} traders`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error({ error: error.message }, '❌ Script failed');
  process.exit(1);
});
