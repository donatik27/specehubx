import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * TEST ENDPOINT - Verify Data API works
 * GET /api/test-data-api?market={marketId}
 */
export async function GET(request: NextRequest) {
  const marketId = request.nextUrl.searchParams.get('market') || '680392'
  const logs: string[] = []
  
  try {
    logs.push(`🔍 Testing Data API for market ${marketId}`)
    
    // Step 1: Get conditionId
    logs.push('\n📡 Step 1: Fetching market info from Gamma API...')
    const marketUrl = `https://gamma-api.polymarket.com/markets/${marketId}`
    logs.push(`URL: ${marketUrl}`)
    
    const marketRes = await fetch(marketUrl, { cache: 'no-store' })
    logs.push(`Status: ${marketRes.status}`)
    
    if (!marketRes.ok) {
      return NextResponse.json({ success: false, logs, error: 'Failed to fetch market' })
    }
    
    const marketData = await marketRes.json()
    const conditionId = marketData.conditionId
    
    if (!conditionId) {
      return NextResponse.json({ success: false, logs, error: 'No conditionId found', marketData })
    }
    
    logs.push(`✅ Got conditionId: ${conditionId}`)
    
    // Step 2: Get trades from Data API
    logs.push('\n📡 Step 2: Fetching trades from Data API...')
    const params = new URLSearchParams({
      market: conditionId,
      limit: '10',
      filterType: 'CASH',
      filterAmount: '100',
    })
    
    const tradesUrl = `https://data-api.polymarket.com/v1/trades?${params}`
    logs.push(`URL: ${tradesUrl}`)
    
    const tradesRes = await fetch(tradesUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
    
    logs.push(`Status: ${tradesRes.status}`)
    
    if (!tradesRes.ok) {
      const error = await tradesRes.text()
      return NextResponse.json({ success: false, logs, error, status: tradesRes.status })
    }
    
    const trades = await tradesRes.json()
    
    if (!Array.isArray(trades)) {
      return NextResponse.json({ 
        success: false, 
        logs, 
        error: 'Response is not an array',
        responseType: typeof trades,
        response: trades
      })
    }
    
    logs.push(`✅ Got ${trades.length} trades!`)
    
    // Step 3: Show sample trades
    if (trades.length > 0) {
      logs.push('\n📊 Sample trades:')
      trades.slice(0, 3).forEach((trade: any, i: number) => {
        const size = parseFloat(trade.size || '0')
        const price = parseFloat(trade.price || '0')
        const amount = size * price
        logs.push(`  ${i + 1}. ${trade.side} $${amount.toFixed(2)} @ ${(price * 100).toFixed(1)}¢ by ${trade.proxyWallet?.slice(0, 8)}...`)
      })
    }
    
    return NextResponse.json({
      success: true,
      logs,
      totalTrades: trades.length,
      sampleTrades: trades.slice(0, 3),
      conditionId,
    })
    
  } catch (error: any) {
    logs.push(`\n❌ Error: ${error.message}`)
    return NextResponse.json({ success: false, logs, error: error.message })
  }
}
