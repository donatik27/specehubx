import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Fetch price history for a token from Polymarket
 * Endpoint: GET /api/price-history?tokenId=XXX&fidelity=1
 * 
 * Fidelity options:
 * 1 = 1 minute candles (recent data)
 * 5 = 5 minute candles
 * 60 = 1 hour candles
 * 1440 = 1 day candles (historical)
 * 
 * Docs: https://docs.polymarket.com/api-reference/pricing/get-price-history-for-a-traded-token
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tokenId = searchParams.get('tokenId')
    const fidelity = searchParams.get('fidelity') || '60' // Default 1 hour candles
    const startTs = searchParams.get('startTs') // Optional start timestamp

    if (!tokenId) {
      return NextResponse.json(
        { error: 'tokenId is required' },
        { status: 400 }
      )
    }

    // Build Polymarket API URL
    let url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${fidelity}`
    if (startTs) {
      url += `&startTs=${startTs}`
    }

    console.log(`📊 Fetching price history: ${url}`)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store', // Always get fresh data
    })

    if (!response.ok) {
      console.error(`❌ Polymarket API error: ${response.status}`)
      return NextResponse.json(
        { error: 'Failed to fetch price history', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Polymarket returns array of: { t: timestamp, p: price }
    // Transform to our format
    const history = data.history || data || []
    
    const pricePoints = history.map((point: any) => ({
      timestamp: point.t * 1000, // Convert to milliseconds
      price: parseFloat(point.p),
      time: new Date(point.t * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }))

    console.log(`✅ Fetched ${pricePoints.length} price points for token ${tokenId}`)

    return NextResponse.json({
      tokenId,
      fidelity,
      count: pricePoints.length,
      history: pricePoints
    })

  } catch (error: any) {
    console.error('Price history error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
