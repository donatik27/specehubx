import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Market Trades API - Returns real trades from Polymarket Data API
 * GET /api/market-trades?market={marketId}&limit={limit}
 * 
 * Uses PUBLIC Data API - no authentication needed!
 * Endpoint: https://data-api.polymarket.com/v1/trades
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('market')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    if (!marketId) {
      return NextResponse.json({ error: 'Missing market parameter' }, { status: 400 })
    }

    console.log(`[market-trades] 🔍 Fetching trades for market ${marketId}`)

    // Step 1: Get market info to get conditionId
    const marketResponse = await fetch(
      `https://gamma-api.polymarket.com/markets/${marketId}`,
      { cache: 'no-store' }
    )

    if (!marketResponse.ok) {
      console.error('[market-trades] ❌ Failed to fetch market info')
      return NextResponse.json({ trades: [], marketInfo: null })
    }

    const marketData = await marketResponse.json()
    const conditionId = marketData.conditionId
    
    if (!conditionId) {
      console.error('[market-trades] ❌ No conditionId found')
      return NextResponse.json({ trades: [], marketInfo: null })
    }

    console.log(`[market-trades] ✅ Found conditionId: ${conditionId}`)
    
    // Extract market info for Hub display! 🎯
    const marketInfo = {
      title: marketData.question || marketData.title || 'Market',
      volume: parseFloat(marketData.volume || marketData.volumeNum || '0'),
      image: marketData.image || marketData.icon || ''
    }
    console.log(`[market-trades] 📊 Market info: ${marketInfo.title}, volume: $${marketInfo.volume.toFixed(0)}`)
    console.log(`[market-trades] 🖼️ Image: ${marketInfo.image}`)

    // Step 2: Fetch trades from PUBLIC Data API
    // This returns ALL historical trades, not just recent ones!
    const params = new URLSearchParams({
      market: conditionId,
      limit: Math.min(limit, 1000).toString(), // Max 1000 per request
      filterType: 'CASH',
      filterAmount: '100', // Min $100 for whale trades
    })

    const tradesUrl = `https://data-api.polymarket.com/v1/trades?${params}`
    console.log(`[market-trades] 📡 Calling Data API: ${tradesUrl}`)

    const tradesResponse = await fetch(tradesUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    })

    if (!tradesResponse.ok) {
      const error = await tradesResponse.text()
      console.error('[market-trades] ❌ Data API failed:', tradesResponse.status, error)
      return NextResponse.json({ trades: [], marketInfo })
    }

    const trades = await tradesResponse.json()
    
    if (!Array.isArray(trades)) {
      console.error('[market-trades] ❌ Unexpected response format:', typeof trades)
      return NextResponse.json({ trades: [], marketInfo })
    }

    console.log(`[market-trades] 🎉 Got ${trades.length} REAL trades from Data API!`)

    // Sort by timestamp (newest first)
    trades.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime()
      const timeB = new Date(b.timestamp || 0).getTime()
      return timeB - timeA
    })
    
    // Return both trades AND market info! 🎯
    return NextResponse.json({ trades, marketInfo })

  } catch (error: any) {
    console.error('[market-trades] ❌ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
