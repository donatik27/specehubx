import { NextRequest, NextResponse } from 'next/server'

/**
 * Get token IDs for a market from Polymarket API
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const marketId = searchParams.get('marketId')

  if (!marketId) {
    return NextResponse.json(
      { error: 'Market ID required' },
      { status: 400 }
    )
  }

  try {
    // Fetch market details from Polymarket Gamma API
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets/${marketId}`
    )

    if (!response.ok) {
      throw new Error('Market not found')
    }

    const market = await response.json()

    // Extract token IDs
    const tokens = market.tokens?.map((token: any) => ({
      tokenId: token.token_id,
      outcome: token.outcome,
      price: token.price,
    })) || []

    return NextResponse.json({ tokens })
  } catch (error: any) {
    console.error('Error fetching market tokens:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tokens' },
      { status: 500 }
    )
  }
}
