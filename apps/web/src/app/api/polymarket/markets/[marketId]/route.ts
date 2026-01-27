import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { marketId: string } }
) {
  try {
    const marketId = params.marketId
    const url = `https://gamma-api.polymarket.com/markets/${marketId}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Polymarket API returned ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()

    // Normalize clobTokenIds and outcomes (sometimes serialized)
    let clobTokenIds = data.clobTokenIds
    if (typeof clobTokenIds === 'string') {
      try {
        clobTokenIds = JSON.parse(clobTokenIds)
      } catch {
        clobTokenIds = null
      }
    }

    let outcomes = data.outcomes
    if (typeof outcomes === 'string') {
      try {
        outcomes = JSON.parse(outcomes)
      } catch {
        outcomes = null
      }
    }
    if (!Array.isArray(outcomes)) {
      outcomes = ['Yes', 'No']
    }

    // Normalize tokens for binary markets using clobTokenIds
    if (!Array.isArray(data.tokens) && Array.isArray(clobTokenIds)) {
      data.tokens = clobTokenIds.map((tokenId: string, index: number) => ({
        token_id: tokenId,
        outcome: outcomes[index] || (index === 0 ? 'Yes' : 'No'),
      }))
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
