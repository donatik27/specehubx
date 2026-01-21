import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Import Prisma for direct DB access (fallback when Railway is down)
let prisma: any
try {
  const { prisma: prismaClient } = require('@polymarket/database')
  prisma = prismaClient
} catch (error) {
  console.warn('Prisma not available, will rely on Railway API only')
}

// Cache for event lookups (in-memory, resets on redeploy)
const eventCache = new Map<string, { title: string; outcomeCount: number }>()

async function findEventForMarket(marketId: string): Promise<{eventSlug: string; eventTitle: string; outcomeCount: number} | null> {
  try {
    // 1. Fetch market details to get negRiskMarketID
    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`)
    if (!marketRes.ok) return null
    
    const marketData = await marketRes.json()
    if (!marketData.negRiskMarketID) return null
    
    // 2. Search for parent event
    const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=2000')
    if (!eventsRes.ok) return null
    
    const events = await eventsRes.json()
    
    for (const event of events) {
      if (event.markets && Array.isArray(event.markets)) {
        const hasMatch = event.markets.some((m: any) => 
          String(m.id) === String(marketId) || 
          m.negRiskMarketID === marketData.negRiskMarketID
        )
        
        if (hasMatch) {
          const result = {
            eventSlug: event.slug,
            eventTitle: event.title,
            outcomeCount: event.markets.length
          }
          
          // Cache it
          eventCache.set(String(marketId), { title: result.eventTitle, outcomeCount: result.outcomeCount })
          
          return result
        }
      }
    }
    
    return null
  } catch (error) {
    console.error(`Failed to find event for market ${marketId}:`, error)
    return null
  }
}

export async function GET(request: Request) {
  try {
    // 1. Try to fetch from Railway API
    const base = process.env.API_BASE_URL
    let markets: any[] = []
    
    if (base) {
      try {
        const response = await fetch(`${base}/api/smart-markets`, { next: { revalidate: 60 } })
        if (response.ok) {
          markets = await response.json()
          console.log(`✅ Got ${markets.length} markets from Railway API`)
        }
      } catch (error) {
        console.error('Railway API error:', error)
      }
    }
    
    // 2. If no markets from Railway, try DB fallback
    if (markets.length === 0 && prisma) {
      console.log('⚠️  Railway API unavailable, falling back to direct DB query...')
      
      try {
        // Fetch smart markets directly from DB (replicate Railway API logic)
        const dbMarkets = await prisma.market.findMany({
          where: {
            OR: [
              { pinned: true },
              { smartScore: { gte: 24 } }
            ]
          },
          take: 20,
          orderBy: [
            { pinned: 'desc' },
            { smartScore: 'desc' }
          ],
          include: {
            smartTraders: {
              take: 10,
              orderBy: { totalPnl: 'desc' }
            }
          }
        })
        
        // Transform to match Railway API format
        markets = dbMarkets.map((m: any) => ({
          marketId: m.marketId,
          question: m.question,
          eventSlug: m.eventSlug,
          eventTitle: null, // Will be enriched below
          outcomeCount: null,
          currentOdds: m.currentOdds || 0,
          volume: m.volume || 0,
          liquidity: m.liquidity || 0,
          category: m.category || 'Uncategorized',
          smartScore: m.smartScore || 0,
          pinned: m.pinned || false,
          smartTraders: m.smartTraders.map((t: any) => ({
            address: t.address,
            shares: t.shares,
            entryPrice: t.entryPrice,
            position: t.position,
            totalPnl: t.totalPnl
          }))
        }))
        
        console.log(`✅ Got ${markets.length} markets from DB fallback`)
      } catch (dbError) {
        console.error('DB fallback error:', dbError)
      }
    }
    
    // 3. If still no markets, return error
    if (markets.length === 0) {
      return NextResponse.json({ error: 'No markets data available' }, { status: 503 })
    }
    
    // 3. Enrich markets without eventSlug
    const marketsToEnrich = markets.filter((m: any) => !m.eventSlug && m.marketId)
    
    if (marketsToEnrich.length > 0) {
      console.log(`🔍 Enriching ${marketsToEnrich.length} markets...`)
      
      // Process in parallel for speed
      await Promise.all(
        marketsToEnrich.map(async (market) => {
          const eventInfo = await findEventForMarket(market.marketId)
          if (eventInfo) {
            market.eventSlug = eventInfo.eventSlug
            market.eventTitle = eventInfo.eventTitle
            market.outcomeCount = eventInfo.outcomeCount
            console.log(`✅ ${market.marketId} → "${eventInfo.eventTitle}"`)
          } else {
            console.log(`⚠️  ${market.marketId} → No event found`)
          }
        })
      )
    }
    
    return NextResponse.json(markets, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
