import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Market Trades API - Returns real trades from Polymarket CLOB
 * GET /api/market-trades?market={marketId}&limit={limit}
 * 
 * Uses Builder credentials to authenticate with CLOB API
 */

const normalizeBase64 = (value: string) => {
  const padded = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (padded.length % 4)) % 4
  return padded + '='.repeat(padLength)
}

const decodeSecretKey = (value: string) => {
  const trimmed = value.trim()
  if (/^[0-9a-fA-F]+$/.test(trimmed) && (trimmed.length === 64 || trimmed.length === 128)) {
    return Buffer.from(trimmed, 'hex')
  }
  return Buffer.from(normalizeBase64(trimmed), 'base64')
}

function createAuthHeaders(method: string, path: string, apiKey: string, secret: string, passphrase: string) {
  const timestamp = Date.now()
  const message = `${timestamp}${method}${path}`
  const messageBytes = decodeUTF8(message)

  const secretBytes = decodeSecretKey(secret)
  const signingKey = secretBytes.length === 64 
    ? secretBytes 
    : nacl.sign.keyPair.fromSeed(secretBytes).secretKey

  const signature = nacl.sign.detached(messageBytes, signingKey)
  const signatureBase64 = encodeBase64(signature)

  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-PM-Access-Key': apiKey,
    'X-PM-Timestamp': timestamp.toString(),
    'X-PM-Signature': signatureBase64,
    'X-PM-Passphrase': passphrase,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('market')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    if (!marketId) {
      return NextResponse.json({ error: 'Missing market parameter' }, { status: 400 })
    }

    const apiKey = process.env.POLYMARKET_API_KEY
    const secret = process.env.POLYMARKET_SECRET
    const passphrase = process.env.POLYMARKET_PASSPHRASE

    if (!apiKey || !secret || !passphrase) {
      console.error('[market-trades] ❌ Missing CLOB credentials')
      return NextResponse.json({ error: 'CLOB credentials not configured' }, { status: 503 })
    }

    console.log(`[market-trades] 🔍 Fetching trades for market ${marketId}`)

    // Step 1: Get market info to extract token IDs
    const marketResponse = await fetch(
      `https://gamma-api.polymarket.com/markets/${marketId}`,
      { cache: 'no-store' }
    )

    if (!marketResponse.ok) {
      console.error('[market-trades] ❌ Failed to fetch market info')
      return NextResponse.json([])
    }

    const marketData = await marketResponse.json()
    let tokenIds: string[] = []
    
    if (marketData.clobTokenIds) {
      tokenIds = JSON.parse(marketData.clobTokenIds)
      console.log(`[market-trades] ✅ Found ${tokenIds.length} tokens`)
    } else {
      console.error('[market-trades] ❌ No clobTokenIds')
      return NextResponse.json([])
    }

    // Step 2: Fetch trades for each token with authentication
    // IMPORTANT: Add pagination params to get more trades
    const allTrades: any[] = []

    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i]
      
      // Try different approaches:
      // 1. With next_cursor for pagination
      // 2. With limit parameter
      const queries = [
        `/trades?asset_id=${tokenId}&limit=100`,
        `/trades?asset_id=${tokenId}`,
      ]
      
      for (const path of queries) {
        try {
          const headers = createAuthHeaders('GET', path, apiKey, secret, passphrase)
          
          const response = await fetch(`https://clob.polymarket.com${path}`, {
            headers,
            cache: 'no-store'
          })

          if (response.ok) {
            const data = await response.json()
            
            // Handle different response formats
            let trades = []
            if (Array.isArray(data)) {
              trades = data
            } else if (data.data && Array.isArray(data.data)) {
              trades = data.data
            } else if (data.trades && Array.isArray(data.trades)) {
              trades = data.trades
            }
            
            console.log(`[market-trades] ✅ Token ${i + 1}/${tokenIds.length} (${path}): ${trades.length} trades`)
            
            if (trades.length > 0) {
              allTrades.push(...trades)
              break // Found trades, no need to try other queries
            }
          } else {
            const error = await response.json().catch(() => ({}))
            console.warn(`[market-trades] ⚠️ Token ${i + 1} (${path}): ${response.status}`, error)
          }
        } catch (err: any) {
          console.error(`[market-trades] ⚠️ Token ${i + 1} (${path}):`, err.message)
        }
      }
    }

    // Step 3: If no trades from CLOB, try historical data from market volume
    if (allTrades.length === 0) {
      console.log('[market-trades] ℹ️ No trades from CLOB, checking if market has volume...')
      
      const volume24hr = parseFloat(marketData.volume24hr || '0')
      
      if (volume24hr > 0) {
        console.log(`[market-trades] ℹ️ Market has $${volume24hr.toFixed(0)} volume but CLOB returns 0 trades`)
        console.log('[market-trades] ℹ️ This is normal - CLOB /trades only shows VERY RECENT trades')
        console.log('[market-trades] 💡 Whale Activity will update when new trades happen!')
      }
    }

    allTrades.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime()
      const timeB = new Date(b.timestamp || 0).getTime()
      return timeB - timeA
    })

    const limitedTrades = allTrades.slice(0, limit)
    console.log(`[market-trades] 🎉 Returning ${limitedTrades.length} REAL trades`)
    
    return NextResponse.json(limitedTrades)

  } catch (error: any) {
    console.error('[market-trades] ❌ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
