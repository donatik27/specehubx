import { NextResponse } from 'next/server'

// Force dynamic rendering - this route needs DATABASE_URL at runtime
export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventSlug = searchParams.get('eventSlug')
  const marketId = searchParams.get('marketId')

  if (!eventSlug && !marketId) {
    return NextResponse.json({ error: 'eventSlug or marketId required' }, { status: 400 })
  }

  let prisma: any = null
  if (process.env.DATABASE_URL) {
    try {
      const db = await import('@polymarket/database')
      prisma = db.prisma
    } catch (e) {
      console.warn('⚠️  Prisma not available for multi-outcome API')
    }
  }

  if (!prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 })
  }

  try {
    // If marketId provided, find eventSlug first
    let targetEventSlug = eventSlug

    if (marketId && !eventSlug) {
      // Try to find eventSlug from multi-outcome positions
      const position = await prisma.multiOutcomePosition.findFirst({
        where: { marketId },
        select: { eventSlug: true },
      })
      
      if (position) {
        targetEventSlug = position.eventSlug
      } else {
        // Try to get from market table
        const market = await prisma.market.findUnique({
          where: { id: marketId },
          select: { eventSlug: true },
        })
        targetEventSlug = market?.eventSlug || null
      }
    }

    if (!targetEventSlug) {
      return NextResponse.json({ 
        eventSlug: null,
        outcomes: [] 
      })
    }

    // Fetch all positions for this event
    const positions = await prisma.multiOutcomePosition.findMany({
      where: {
        eventSlug: targetEventSlug,
        computedAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Last 48 hours
        },
      },
      orderBy: {
        shares: 'desc',
      },
    })

    // Group by outcome
    const outcomeMap = new Map<string, {
      marketId: string
      outcomeTitle: string
      currentPrice: number
      smartPositions: Array<{
        traderAddress: string
        traderName: string | null
        tier: string
        position: string
        shares: number
        entryPrice: number
      }>
      totalSmartShares: number
      smartTraderCount: number
    }>()

    for (const pos of positions) {
      const key = pos.marketId
      
      if (!outcomeMap.has(key)) {
        outcomeMap.set(key, {
          marketId: pos.marketId,
          outcomeTitle: pos.outcomeTitle,
          currentPrice: pos.currentPrice,
          smartPositions: [],
          totalSmartShares: 0,
          smartTraderCount: 0,
        })
      }

      const outcome = outcomeMap.get(key)!
      outcome.smartPositions.push({
        traderAddress: pos.traderAddress,
        traderName: pos.traderName,
        tier: pos.traderTier,
        position: pos.position,
        shares: Number(pos.shares),
        entryPrice: pos.entryPrice,
      })
      outcome.totalSmartShares += Number(pos.shares)
      outcome.smartTraderCount++
    }

    // Convert to array and sort by S-tier trader count (most smart first), then by total shares
    const outcomes = Array.from(outcomeMap.values())
      .sort((a, b) => {
        // Primary: Most S-tier traders first
        if (b.smartTraderCount !== a.smartTraderCount) {
          return b.smartTraderCount - a.smartTraderCount
        }
        // Secondary: Most shares first
        return b.totalSmartShares - a.totalSmartShares
      })

    return NextResponse.json({
      eventSlug: targetEventSlug,
      totalOutcomes: outcomes.length,
      outcomes,
    })

  } catch (error) {
    console.error('Failed to fetch multi-outcome positions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
