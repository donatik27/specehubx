import { NextResponse } from 'next/server'

// Force dynamic rendering - this route needs DATABASE_URL at runtime
export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    let prisma: any = null
    if (process.env.DATABASE_URL) {
      try {
        const db = await import('@polymarket/database')
        prisma = db.prisma
      } catch (e) {
        console.warn('⚠️  Prisma not available')
      }
    }

    const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=100', {
      cache: 'no-cache'
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Sort by volume descending
    const sorted = data
      .map((m: any) => {
        // Parse clobTokenIds from JSON string to array
        let tokenIds = []
        try {
          tokenIds = typeof m.clobTokenIds === 'string' 
            ? JSON.parse(m.clobTokenIds) 
            : (m.clobTokenIds || [])
        } catch (e) {
          console.warn(`Failed to parse clobTokenIds for market ${m.id}`)
        }
        
        // Parse outcomes and outcomePrices from JSON strings
        let outcomes = ['YES', 'NO']
        let outcomePrices = ['0.5', '0.5']
        
        try {
          outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || ['YES', 'NO'])
        } catch (e) {
          console.warn(`Failed to parse outcomes for market ${m.id}`)
        }
        
        try {
          outcomePrices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : (m.outcomePrices || ['0.5', '0.5'])
        } catch (e) {
          console.warn(`Failed to parse outcomePrices for market ${m.id}`)
        }
        
        return {
          id: m.id,
          question: m.question,
          slug: m.slug || '',
          negRiskMarketID: m.negRiskMarketID || null,
          category: m.category || 'Uncategorized',
          volume: m.volumeNum || 0,
          liquidity: m.liquidityNum || 0,
          endDate: m.endDate,
          active: m.active,
          closed: m.closed,
          outcomes: outcomes,
          outcomePrices: outcomePrices,
          clobTokenIds: tokenIds
        }
      })
      .filter((m: any) => m.clobTokenIds && m.clobTokenIds.length > 0) // Тільки маркети з tokenIds
      .sort((a: any, b: any) => b.volume - a.volume)
    
    // Enrich with eventSlug from our database if available
    if (prisma) {
      try {
        const marketIds = sorted.map((m: any) => m.id)
        const dbMarkets = await prisma.market.findMany({
          where: {
            id: { in: marketIds }
          },
          select: {
            id: true,
            eventSlug: true
          }
        })
        
        // Create a map for quick lookup
        const eventSlugMap = new Map(
          dbMarkets.map((m: any) => [m.id, m.eventSlug])
        )
        
        // Add eventSlug to sorted markets
        sorted.forEach((market: any) => {
          market.eventSlug = eventSlugMap.get(market.id) || null
        })
        
        console.log(`✅ Enriched ${dbMarkets.length}/${sorted.length} markets with eventSlug`)
      } catch (e) {
        console.warn('⚠️  Failed to enrich with eventSlug:', e)
      }
    }
    
    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Failed to fetch markets:', error)
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
  }
}
