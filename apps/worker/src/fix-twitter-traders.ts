import 'dotenv/config';
import prisma from '@polymarket/database';
import { logger } from './lib/logger';

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔧 FIXING TWITTER TRADERS - CORRECT ALGORITHM');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // STEP 1: Load ALL top-1000 traders from Polymarket (month leaderboard)
  logger.info('📥 Loading top-1000 from Polymarket (MONTH)...');
  
  const allPolymarketTraders: any[] = [];
  const BATCH_SIZE = 100;
  
  for (let offset = 0; offset < 1000; offset += BATCH_SIZE) {
    const res = await fetch(
      `https://data-api.polymarket.com/v1/leaderboard?timePeriod=month&orderBy=PNL&limit=${BATCH_SIZE}&offset=${offset}`
    );
    
    if (!res.ok) {
      logger.error({ status: res.status }, 'Polymarket API error');
      break;
    }
    
    const batch = await res.json();
    if (batch.length === 0) break;
    
    allPolymarketTraders.push(...batch);
    logger.info(`   ✓ Loaded ${allPolymarketTraders.length} traders...`);
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  logger.info(`✅ Loaded ${allPolymarketTraders.length} traders from Polymarket`);
  
  // STEP 2: Filter only traders WITH Twitter
  const tradersWithTwitter = allPolymarketTraders.filter(t => t.xUsername && t.xUsername.trim());
  logger.info(`✅ Found ${tradersWithTwitter.length} traders with Twitter in Polymarket`);
  logger.info('');
  
  // STEP 3: Get all traders from DB with Twitter (for matching)
  const dbTraders = await prisma.trader.findMany({
    where: {
      twitterUsername: { not: null },
    },
  });
  
  logger.info(`📊 Database has ${dbTraders.length} traders with Twitter`);
  logger.info('');
  
  // STEP 4: Match and update
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔄 MATCHING & UPDATING...');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const normalizeUsername = (u: string) => u.replace('@', '').trim().toLowerCase();
  
  // Create a map for fast lookup: normalized Twitter username -> Polymarket data
  const polymarketMap = new Map<string, any>();
  for (const t of tradersWithTwitter) {
    const normalized = normalizeUsername(t.xUsername);
    polymarketMap.set(normalized, t);
  }
  
  let fixed = 0;
  let alreadyCorrect = 0;
  let notFound = 0;
  
  for (const dbTrader of dbTraders) {
    const dbUsername = normalizeUsername(dbTrader.twitterUsername!);
    
    // Find matching trader in Polymarket data
    const polymarketData = polymarketMap.get(dbUsername);
    
    if (polymarketData) {
      // Check if update is needed (PnL is different or address is different)
      const newPnl = polymarketData.pnl || 0;
      const currentPnl = dbTrader.totalPnl as number;
      const newAddress = polymarketData.proxyWallet;
      
      // Update if PnL changed significantly (more than 1K difference) OR address is different
      if (Math.abs(newPnl - currentPnl) > 1000 || dbTrader.address !== newAddress) {
        const volume = polymarketData.volume || 0;
        const marketsTraded = polymarketData.markets_traded || 10;
        const winRate = marketsTraded > 0 && newPnl > 0 
          ? Math.min(((newPnl / (volume || newPnl)) * 100), 75)
          : 50;
        
        // Determine tier based on PnL
        let tier = 'B';
        if (newPnl > 100000 || polymarketData.xUsername) tier = 'S';
        else if (newPnl > 50000) tier = 'A';
        
        // If address changed, we need to handle potential conflicts
        if (dbTrader.address !== newAddress) {
          // Check if new address already exists
          const existingWithNewAddress = await prisma.trader.findUnique({
            where: { address: newAddress },
          });
          
          if (existingWithNewAddress) {
            // Update existing trader with new address
            await prisma.trader.update({
              where: { address: newAddress },
              data: {
                totalPnl: newPnl,
                realizedPnl: newPnl,
                profilePicture: polymarketData.profileImage || existingWithNewAddress.profilePicture,
                displayName: polymarketData.userName || existingWithNewAddress.displayName,
                twitterUsername: polymarketData.xUsername,
                tier: tier as any,
                tradeCount: marketsTraded,
                winRate: winRate,
                rarityScore: Math.floor(newPnl + (volume * 0.1)),
              },
            });
            
            // Delete old trader with fake/wrong address
            await prisma.trader.delete({
              where: { address: dbTrader.address },
            });
            
            logger.info(`   ✅ MERGED: @${polymarketData.xUsername} → ${newAddress.slice(0, 10)}... | PnL: $${(newPnl / 1000).toFixed(1)}K | ${tier}`);
          } else {
            // Update address directly
            await prisma.trader.update({
              where: { address: dbTrader.address },
              data: {
                address: newAddress,
                totalPnl: newPnl,
                realizedPnl: newPnl,
                profilePicture: polymarketData.profileImage || dbTrader.profilePicture,
                displayName: polymarketData.userName || dbTrader.displayName,
                twitterUsername: polymarketData.xUsername,
                tier: tier as any,
                tradeCount: marketsTraded,
                winRate: winRate,
                rarityScore: Math.floor(newPnl + (volume * 0.1)),
              },
            });
            
            logger.info(`   ✅ FIXED ADDRESS: @${polymarketData.xUsername} → ${newAddress.slice(0, 10)}... | PnL: $${(newPnl / 1000).toFixed(1)}K | ${tier}`);
          }
        } else {
          // Just update PnL and other data
          await prisma.trader.update({
            where: { address: dbTrader.address },
            data: {
              totalPnl: newPnl,
              realizedPnl: newPnl,
              profilePicture: polymarketData.profileImage || dbTrader.profilePicture,
              displayName: polymarketData.userName || dbTrader.displayName,
              tier: tier as any,
              tradeCount: marketsTraded,
              winRate: winRate,
              rarityScore: Math.floor(newPnl + (volume * 0.1)),
            },
          });
          
          logger.info(`   ✅ UPDATED: @${polymarketData.xUsername} | PnL: $${(newPnl / 1000).toFixed(1)}K | ${tier}`);
        }
        
        fixed++;
      } else {
        alreadyCorrect++;
      }
    } else {
      logger.warn(`   ❌ NOT IN TOP-1000: @${dbTrader.twitterUsername} (keeping current data)`);
      notFound++;
    }
  }
  
  logger.info('');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('✅ FIX COMPLETE!');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`📊 Results:`);
  logger.info(`   ✅ Fixed/Updated: ${fixed} traders`);
  logger.info(`   ✓  Already correct: ${alreadyCorrect} traders`);
  logger.info(`   ❌ Not in top-1000: ${notFound} traders`);
  logger.info(`   📈 Total with Twitter: ${fixed + alreadyCorrect} traders`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error({ error: error.message }, '❌ Script failed');
  process.exit(1);
});
