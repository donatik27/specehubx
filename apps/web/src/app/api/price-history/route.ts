import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Fetch price history for a token from Polymarket
 * Endpoint: GET /api/price-history?tokenId=XXX&interval=1h
 * 
 * Interval options:
 * 1m, 5m, 1h, 6h, 1d, max (all available data)
 * 
 * Docs: https://docs.polymarket.com/developers/CLOB/timeseries
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tokenId = searchParams.get('tokenId')
    const interval = searchParams.get('interval') || 'max' // Default: all data

    if (!tokenId) {
      return NextResponse.json(
        { error: 'tokenId is required' },
        { status: 400 }
      )
    }

    // Build Polymarket API URL
    const url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${interval}`

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
    
    const pricePoints = history.map((point: any) => {
      const timestamp = point.t * 1000 // Convert to milliseconds
      const date = new Date(timestamp)
      
      // Format time based on how old the data is
      const now = Date.now()
      const age = now - timestamp
      const oneDayMs = 24 * 60 * 60 * 1000
      
      let timeFormat
      if (age < oneDayMs) {
        // Recent: show time only
        timeFormat = date.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      } else {
        // Older: show date + time
        timeFormat = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      
      return {
        timestamp,
        price: parseFloat(point.p),
        time: timeFormat
      }
    })

    console.log(`✅ Fetched ${pricePoints.length} price points for token ${tokenId}`)

    return NextResponse.json({
      tokenId,
      interval,
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
