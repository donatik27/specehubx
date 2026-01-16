import 'dotenv/config'
import { prisma } from '@polymarket/database'
import { Tier } from '@polymarket/shared'

const API_BASE = 'https://data-api.polymarket.com/v1'

async function fetchTradersByAddress() {
  console.log('🔍 Fetching missing traders by address...\n')
  
  // Get all traders with geolocation but no PnL data
  const missingTraders = await prisma.trader.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { realizedPnl: 0 },
      ]
    },
    select: {
      address: true,
      twitterUsername: true,
      displayName: true,
    }
  })
  
  console.log(`📊 Found ${missingTraders.length} traders to fetch\n`)
  
  let updated = 0
  let failed = 0
  
  for (const trader of missingTraders) {
    try {
      // Try to fetch trader data from Polymarket API by address
      const response = await fetch(
        `${API_BASE}/trader/${trader.address}`
      )
      
      if (!response.ok) {
        console.log(`   ⚠️  API error for @${trader.twitterUsername}`)
        failed++
        continue
      }
      
      const data = await response.json()
      
      if (!data || !data.pnl) {
        console.log(`   ⚠️  No PnL data for @${trader.twitterUsername}`)
        failed++
        continue
      }
      
      // Determine tier based on PnL
      let tier: Tier = 'D'
      const pnl = data.pnl
      
      if (pnl >= 10000) tier = 'S'
      else if (pnl >= 5000) tier = 'A'
      else if (pnl >= 1000) tier = 'B'
      else if (pnl >= 100) tier = 'C'
      
      // Update trader
      await prisma.trader.update({
        where: { address: trader.address },
        data: {
          realizedPnl: pnl,
          tier,
          lastActiveAt: new Date(),
        }
      })
      
      console.log(`   ✅ Updated: @${trader.twitterUsername} (${trader.displayName}) - $${pnl.toFixed(0)} PnL`)
      updated++
      
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error: any) {
      console.error(`   ❌ Error for @${trader.twitterUsername}:`, error.message)
      failed++
    }
  }
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Updated: ${updated} traders`)
  console.log(`   ❌ Failed: ${failed} traders`)
  console.log('✅ Complete!')
}

fetchTradersByAddress()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
