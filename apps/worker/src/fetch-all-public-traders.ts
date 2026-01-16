import 'dotenv/config'
import { prisma } from '@polymarket/database'
import { Tier } from '@polymarket/shared'

const API_BASE = 'https://data-api.polymarket.com/v1'

interface PolymarketLeaderboardEntry {
  pnl: number
  profileImage: string | null
  proxyWallet: string
  rank: number
  userName: string | null
  verifiedBadge: boolean
  vol: number
  xUsername: string | null
}

const TIMEFRAMES = ['day', 'week', 'month', 'all'] as const

async function fetchAllPublicTraders() {
  console.log('🔍 Fetching ALL public traders from all timeframes...\n')
  
  const allTraders = new Map<string, PolymarketLeaderboardEntry>()
  
  // Fetch from all timeframes
  for (const timeframe of TIMEFRAMES) {
    console.log(`📊 Fetching ${timeframe} leaderboard...`)
    
    let offset = 0
    const limit = 100
    let hasMore = true
    
    // Fetch more for 'all' timeframe, less for others
    const maxOffset = timeframe === 'all' ? 3000 : 1000
    
    while (hasMore && offset < maxOffset) {
      const response = await fetch(
        `${API_BASE}/leaderboard?timePeriod=${timeframe}&orderBy=PNL&limit=${limit}&offset=${offset}&category=overall`
      )
      
      if (!response.ok) {
        console.log(`   ⚠️  API error at offset ${offset}`)
        hasMore = false
        break
      }
      
      const data = await response.json() as PolymarketLeaderboardEntry[]
      
      if (!data || data.length === 0) {
        hasMore = false
        break
      }
      
      // Only save traders with Twitter
      const publicTraders = data.filter(t => t.xUsername)
      
      for (const trader of publicTraders) {
        // Keep the best data (highest PnL version)
        const existing = allTraders.get(trader.proxyWallet)
        if (!existing || Math.abs(trader.pnl) > Math.abs(existing.pnl)) {
          allTraders.set(trader.proxyWallet, trader)
        }
      }
      
      console.log(`   ✅ Fetched ${offset + data.length}/${timeframe} (${publicTraders.length} public in this batch)`)
      offset += limit
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  console.log(`\n📊 Found ${allTraders.size} UNIQUE public traders across all timeframes`)
  
  // Save to database
  console.log('\n💾 Saving to database...\n')
  
  let saved = 0
  let updated = 0
  
  for (const [address, trader] of allTraders.entries()) {
    // Determine tier based on PnL
    let tier: Tier = 'D'
    const pnl = trader.pnl
    
    if (pnl >= 10000) tier = 'S'
    else if (pnl >= 5000) tier = 'A'
    else if (pnl >= 1000) tier = 'B'
    else if (pnl >= 100) tier = 'C'
    
    try {
      const existing = await prisma.trader.findUnique({
        where: { address }
      })
      
      if (existing) {
        // Update existing
        await prisma.trader.update({
          where: { address },
          data: {
            displayName: trader.userName || existing.displayName,
            profilePicture: trader.profileImage || existing.profilePicture,
            realizedPnl: trader.pnl,
            tier,
            twitterUsername: trader.xUsername,
            lastActiveAt: new Date(),
          }
        })
        updated++
        console.log(`   ✅ Updated: @${trader.xUsername} (${trader.userName || 'Unknown'}) - $${trader.pnl.toFixed(0)} PnL`)
      } else {
        // Create new
        await prisma.trader.create({
          data: {
            address,
            displayName: trader.userName || `Trader ${address.slice(0, 8)}`,
            profilePicture: trader.profileImage,
            realizedPnl: trader.pnl,
            tier,
            twitterUsername: trader.xUsername,
            lastActiveAt: new Date(),
          }
        })
        saved++
        console.log(`   ✅ Created: @${trader.xUsername} (${trader.userName || 'Unknown'}) - $${trader.pnl.toFixed(0)} PnL`)
      }
    } catch (error) {
      console.error(`   ❌ Error saving ${trader.userName || address}:`, error)
    }
  }
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Created: ${saved} new traders`)
  console.log(`   ✅ Updated: ${updated} existing traders`)
  console.log(`   📊 Total: ${saved + updated} public traders in database`)
  console.log('\n✅ All public traders fetched and saved!')
}

fetchAllPublicTraders()
  .then(() => {
    console.log('✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
