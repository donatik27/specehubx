import { NextResponse } from 'next/server'
import { proxyGet } from '../_lib/proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Fetch directly from Railway API (не через proxy)
  const base = process.env.API_BASE_URL
  if (!base) {
    return NextResponse.json({ error: 'API service not configured' }, { status: 503 })
  }
  
  try {
    // Fetch from Railway API
    const response = await fetch(`${base}/api/smart-markets`)
    if (!response.ok) {
      return NextResponse.json({ error: 'Railway API error' }, { status: 500 })
    }
    
    const markets = await response.json()
  
  // Enrich markets without eventSlug by fetching from Polymarket
  const marketsToEnrich = markets.filter((m: any) => !m.eventSlug && m.marketId)
  
  if (marketsToEnrich.length > 0) {
    console.log(`🔍 Enriching ${marketsToEnrich.length} markets without eventSlug...`)
    
    for (const market of marketsToEnrich) {
      try {
        // Fetch market details to get negRiskMarketID
        const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${market.marketId}`)
        if (marketRes.ok) {
          const marketData = await marketRes.json()
          
          if (marketData.negRiskMarketID) {
            // Search for parent event
            const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=2000')
            if (eventsRes.ok) {
              const events = await eventsRes.json()
              
              for (const event of events) {
                if (event.markets && Array.isArray(event.markets)) {
                  const hasMatch = event.markets.some((m: any) => 
                    m.id === market.marketId || m.negRiskMarketID === marketData.negRiskMarketID
                  )
                  
                  if (hasMatch) {
                    market.eventSlug = event.slug
                    market.eventTitle = event.title
                    market.outcomeCount = event.markets.length
                    console.log(`✅ Found event "${event.title}" for market ${market.marketId}`)
                    break
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to enrich market ${market.marketId}:`, error)
      }
    }
  }
  
  return NextResponse.json(markets)
  
  } catch (error: any) {
    console.error('API enrichment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
