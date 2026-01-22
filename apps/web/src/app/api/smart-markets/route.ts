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

async function findEventForMarket(marketId: string, existingEventSlug?: string | null): Promise<{eventSlug: string; eventTitle: string; outcomeCount: number} | null> {
  try {
    // If we already have eventSlug, fetch event directly
    if (existingEventSlug) {
      const eventsRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${existingEventSlug}`)
      if (eventsRes.ok) {
        const events = await eventsRes.json()
        if (events && events[0]) {
          const event = events[0]
          return {
            eventSlug: event.slug,
            eventTitle: event.title,
            outcomeCount: event.markets?.length || 0
          }
        }
      }
    }
    
    // Otherwise, search by negRiskMarketID
    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`)
    if (!marketRes.ok) return null
    
    const marketData = await marketRes.json()
    if (!marketData.negRiskMarketID) return null
    
    // Search for parent event in top 500 (API max)
    const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=500')
    if (!eventsRes.ok) return null
    
    const events = await eventsRes.json()
    
    for (const event of events) {
      if (event.markets && Array.isArray(event.markets)) {
        const hasMatch = event.markets.some((m: any) => 
          String(m.id) === String(marketId) || 
          m.negRiskMarketID === marketData.negRiskMarketID
        )
        
        if (hasMatch) {
          return {
            eventSlug: event.slug,
            eventTitle: event.title,
            outcomeCount: event.markets.length
          }
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
        // Fetch smart markets directly from DB (query MarketSmartStats, not Market!)
        const stats = await prisma.marketSmartStats.findMany({
          where: {
            computedAt: {
              gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
            },
            market: {
              status: 'OPEN',
              endDate: {
                gte: new Date()
              }
            }
          },
          orderBy: [{ smartScore: 'desc' }, { smartCount: 'desc' }],
          take: 20,
          include: {
            market: {
              select: {
                id: true,
                question: true,
                category: true,
                volume: true,
                liquidity: true,
                endDate: true,
                slug: true,
                eventSlug: true,
              },
            },
          },
        })
        
        // Transform to match Railway API format
        markets = stats.map((stat: any) => ({
          marketId: stat.marketId,
          question: stat.market.question,
          category: stat.market.category || 'Market',
          volume: stat.market.volume ? Number(stat.market.volume) : 0,
          liquidity: stat.market.liquidity ? Number(stat.market.liquidity) : 0,
          endDate: stat.market.endDate,
          smartCount: stat.smartCount,
          smartWeighted: Number(stat.smartWeighted),
          smartScore: Number(stat.smartScore),
          topTraders: stat.topSmartTraders || [],
          lastUpdate: stat.computedAt,
          isPinned: stat.isPinned,
          priority: stat.priority,
          marketSlug: stat.market.slug,
          eventSlug: stat.market.eventSlug,
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
    
    // 3. Enrich markets without eventTitle (fetch from Polymarket using eventSlug or negRiskMarketID)
    const marketsToEnrich = markets.filter((m: any) => !m.eventTitle && m.marketId)
    
    if (marketsToEnrich.length > 0) {
      console.log(`🔍 Enriching ${marketsToEnrich.length} markets...`)
      
      // Process in parallel for speed
      await Promise.all(
        marketsToEnrich.map(async (market) => {
          const eventInfo = await findEventForMarket(market.marketId, market.eventSlug)
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
