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

    // ========== MODE 1: DATABASE (Real on-chain data) ==========
    if (prisma) {
      console.log('✅ Reading from DATABASE (real on-chain data)...');
      
      const stats = await prisma.marketSmartStats.findMany({
        where: {
          computedAt: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000) // Last 48 hours
          }
        },
        orderBy: [
          { smartScore: 'desc' },
          { smartCount: 'desc' }
        ],
        take: 20,
        include: {
          market: {
            select: {
              id: true,
              question: true,
              category: true,
              volume: true,
              endDate: true,
              slug: true,
              eventSlug: true
            }
          }
        }
      });
      
      console.log(`✅ Found ${stats.length} smart markets in DB`);
      
      // Transform data (no external API calls for speed)
      const enriched = stats.map((stat: any) => ({
        marketId: stat.marketId,
        question: stat.market.question,
        category: stat.market.category || 'Uncategorized',
        volume: stat.market.volume ? Number(stat.market.volume) : 0,
        endDate: stat.market.endDate,
        smartCount: stat.smartCount,
        smartWeighted: Number(stat.smartWeighted),
        smartScore: Number(stat.smartScore),
        topTraders: stat.topSmartTraders || [],
        lastUpdate: stat.computedAt,
        isPinned: stat.isPinned,
        priority: stat.priority,
        marketSlug: stat.market.slug,
        eventSlug: stat.market.eventSlug
      }));
      
      // DEDUPLICATE: Keep only the latest entry for each marketId
      const uniqueMarkets = new Map<string, any>();
      for (const market of enriched) {
        const existing = uniqueMarkets.get(market.marketId);
        if (!existing || new Date(market.lastUpdate) > new Date(existing.lastUpdate)) {
          uniqueMarkets.set(market.marketId, market);
        }
      }
      
      const deduplicated = Array.from(uniqueMarkets.values())
        .sort((a, b) => b.smartScore - a.smartScore); // Re-sort after deduplication
      
      console.log(`✅ Deduplicated: ${stats.length} → ${deduplicated.length} unique markets`);
      
      return NextResponse.json(deduplicated);
    }
    
    // ========== MODE 2: FALLBACK (no DB) ==========
    console.log('⚠️  No database, returning empty array');
    return NextResponse.json([]);
    
  } catch (error: any) {
    console.error('❌ API error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
