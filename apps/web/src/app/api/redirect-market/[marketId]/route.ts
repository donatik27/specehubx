import { NextResponse } from 'next/server'

// Force dynamic rendering - this route needs DATABASE_URL at runtime
export const dynamic = 'force-dynamic'


export async function GET(
  request: Request,
  { params }: { params: { marketId: string } }
) {
  const marketId = params.marketId

  let prisma: any = null
  if (process.env.DATABASE_URL) {
    try {
      const db = await import('@polymarket/database')
      prisma = db.prisma
    } catch (e) {
      console.warn('⚠️  Prisma not available')
    }
  }
  
  try {
    // 1. Check if we have eventSlug in database
    if (prisma) {
      const market = await prisma.market.findUnique({
        where: { id: marketId },
        select: { eventSlug: true, slug: true, question: true }
      })
      
      if (market?.eventSlug) {
        console.log(`✅ Found eventSlug in DB for ${marketId}: ${market.eventSlug}`)
        return NextResponse.redirect(`https://polymarket.com/event/${market.eventSlug}?via=01k`)
      }
    }
    
    // 2. Fetch market details from Polymarket API to get negRiskMarketID
    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
      cache: 'no-cache'
    })
    
    if (!marketRes.ok) {
      console.log(`❌ Could not fetch market ${marketId}`)
      return NextResponse.redirect('https://polymarket.com?via=01k')
    }
    
    const marketData = await marketRes.json()
    
    // 3. Try to find parent event by searching with negRiskMarketID or marketId
    try {
      const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=1000&closed=false', {
        cache: 'no-cache'
      })
      
      if (eventsRes.ok) {
        const events = await eventsRes.json()
        
        // Find event that contains this marketId OR has same negRiskMarketID
        const parentEvent = events.find((e: any) => {
          if (!e.markets || !Array.isArray(e.markets)) return false
          
          return e.markets.some((m: any) => 
            m.id === marketId || 
            (marketData.negRiskMarketID && m.negRiskMarketID === marketData.negRiskMarketID)
          )
        })
        
        if (parentEvent?.slug) {
          console.log(`✅ Found eventSlug from API for ${marketId}: ${parentEvent.slug}`)
          
          // Save to DB for next time
          if (prisma) {
            try {
              await prisma.market.upsert({
                where: { id: marketId },
                create: {
                  id: marketId,
                  question: marketData.question,
                  eventSlug: parentEvent.slug,
                  slug: marketData.slug
                },
                update: {
                  eventSlug: parentEvent.slug
                }
              })
            } catch (e) {
              console.warn('Failed to save eventSlug to DB:', e)
            }
          }
          
          return NextResponse.redirect(`https://polymarket.com/event/${parentEvent.slug}?via=01k`)
        }
      }
    } catch (e) {
      console.warn('Failed to fetch events:', e)
    }
    
    // 4. Try using market's slug (works for both standalone and multi-outcome markets)
    if (marketData.slug) {
      console.log(`✅ Using market slug for ${marketId}: ${marketData.slug}`)
      
      // Save to DB for next time
      if (prisma) {
        try {
          await prisma.market.upsert({
            where: { id: marketId },
            create: {
              id: marketId,
              question: marketData.question,
              slug: marketData.slug
            },
            update: {
              slug: marketData.slug
            }
          })
        } catch (e) {
          console.warn('Failed to save slug to DB:', e)
        }
      }
      
      return NextResponse.redirect(`https://polymarket.com/event/${marketData.slug}?via=01k`)
    }
    
    // 6. Final fallback: use search
    const searchUrl = `https://polymarket.com/search?q=${encodeURIComponent(marketData.question)}&referral=01k`
    console.log(`⚠️  Using search fallback for ${marketId}`)
    return NextResponse.redirect(searchUrl)
    
  } catch (error: any) {
    console.error(`❌ Error redirecting market ${marketId}:`, error.message)
    return NextResponse.redirect('https://polymarket.com?via=01k')
  }
}
