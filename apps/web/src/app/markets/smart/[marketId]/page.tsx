'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Activity, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Market {
  id: string
  question: string
  slug: string
  eventSlug?: string // Polymarket event slug (same as Hot Markets!)
  negRiskMarketID?: string
  category: string
  volume: number
  liquidity: number
  outcomes: string[]
  outcomePrices: string[]
  endDate: string
}

interface EventInfo {
  eventSlug: string
  eventTitle: string
  eventDescription: string
  eventImage: string
  totalVolume: number
  topOutcomes: Array<{
    id: string
    question: string
    price: number
    volume: number
  }>
}

interface SmartTrader {
  address: string
  displayName: string
  avatar: string
  tier: string
  rarityScore: number
  outcome: string // YES, NO, or specific outcome
  price: number // Entry price (0-1)
  amount: number // Amount bet
}

interface MultiOutcomePosition {
  marketId: string
  outcomeTitle: string
  currentPrice: number
  smartPositions: Array<{
    traderAddress: string
    traderName: string
    tier: string
    position: string
    shares: number
    entryPrice: number
  }>
  totalSmartShares: number
  smartTraderCount: number
}

// Extract team/player names from sports questions like "Red Wings vs Maple Leafs"
function extractSportsOutcomes(question: string): string[] | null {
  // Match "Team A vs Team B" or "Team A v. Team B" or "Team A v Team B"
  const vsMatch = question.match(/(?:Will\s+(?:the\s+)?)?(.+?)\s+(?:vs\.?|v\.)\s+(.+?)(?:\s+win|\?|$)/i)
  if (vsMatch) {
    return [vsMatch[1].trim(), vsMatch[2].trim()]
  }
  
  // Match "Team A or Team B" pattern
  const orMatch = question.match(/(?:Will\s+)?(.+?)\s+or\s+(.+?)(?:\s+win|\?|$)/i)
  if (orMatch) {
    return [orMatch[1].trim(), orMatch[2].trim()]
  }
  
  return null
}

// Smart function to extract key info from outcome titles
function extractOutcomeShortName(outcomeTitle: string, allOutcomes: MultiOutcomePosition[]): string {
  // Try to extract name after "nominate" or "elect" or "appoint"
  const nominateMatch = outcomeTitle.match(/(?:nominate|elect|appoint)\s+(.+?)\s+(?:as|for|to)/i)
  if (nominateMatch) {
    return nominateMatch[1].trim()
  }

  // Try to extract team/entity name before "win" or "make"
  const winMatch = outcomeTitle.match(/Will\s+(?:the\s+)?(.+?)\s+(?:win|make|reach|qualify)/i)
  if (winMatch) {
    return winMatch[1].trim()
  }

  // Try to extract date ranges (e.g., "by June 30, 2026")
  const dateMatch = outcomeTitle.match(/(?:by|in|before)\s+([\w\s,]+\d{4})/i)
  if (dateMatch) {
    return dateMatch[1].trim()
  }

  // Try to extract numbers or ranges (e.g., "250,000-500,000")
  const numberMatch = outcomeTitle.match(/(\d[\d,\-\.]+(?:\s*(?:million|billion|thousand|[KMB]))?)/i)
  if (numberMatch) {
    return numberMatch[1].trim()
  }

  // Fallback: Find common prefix/suffix and remove it
  if (allOutcomes.length > 1) {
    const titles = allOutcomes.map(o => o.outcomeTitle)
    
    // Find common prefix
    let commonPrefix = titles[0]
    for (const title of titles) {
      while (!title.startsWith(commonPrefix) && commonPrefix.length > 0) {
        commonPrefix = commonPrefix.slice(0, -1)
      }
    }
    
    // Find common suffix
    let commonSuffix = titles[0]
    for (const title of titles) {
      while (!title.endsWith(commonSuffix) && commonSuffix.length > 0) {
        commonSuffix = commonSuffix.slice(1)
      }
    }
    
    // Remove common parts
    let shortName = outcomeTitle
    if (commonPrefix.length > 10) {
      shortName = shortName.replace(commonPrefix, '').trim()
    }
    if (commonSuffix.length > 10) {
      shortName = shortName.replace(new RegExp(commonSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '').trim()
    }
    
    if (shortName.length > 0 && shortName.length < outcomeTitle.length - 10) {
      return shortName
    }
  }

  // Final fallback: return first 50 chars
  return outcomeTitle.length > 50 ? outcomeTitle.substring(0, 47) + '...' : outcomeTitle
}

export default function SmartMarketDetailPage() {
  const params = useParams()
  const marketId = params.marketId as string

  const [market, setMarket] = useState<Market | null>(null)
  const [eventSlug, setEventSlug] = useState<string | null>(null)
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [smartTraders, setSmartTraders] = useState<SmartTrader[]>([])
  const [multiOutcomePositions, setMultiOutcomePositions] = useState<MultiOutcomePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOutcomes, setExpandedOutcomes] = useState<Set<number>>(new Set()) // Track expanded outcomes
  
  const toggleOutcome = (idx: number) => {
    setExpandedOutcomes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(idx)) {
        newSet.delete(idx)
      } else {
        newSet.add(idx)
      }
      return newSet
    })
  }

  useEffect(() => {
    fetchMarketDetails()
  }, [marketId])

  // Auto-refresh prices every 15 seconds to stay in sync with Polymarket
  useEffect(() => {
    if (!marketId || !market) return
    
    const refreshPrices = async () => {
      try {
        // Update main market prices via our API
        const priceRes = await fetch(`/api/market-price?marketId=${marketId}`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          
          setMarket(prev => prev ? {
            ...prev,
            outcomes: priceData.outcomes,
            outcomePrices: priceData.outcomePrices
          } : null)
          
          console.log(`🔄 Prices updated: ${priceData.outcomePrices[0]} / ${priceData.outcomePrices[1]} (${(parseFloat(priceData.outcomePrices[0]) * 100).toFixed(1)}% / ${(parseFloat(priceData.outcomePrices[1]) * 100).toFixed(1)}%)`)
        }
        
        // Update multi-outcome prices if present
        const currentPositions = multiOutcomePositions
        if (currentPositions.length > 0) {
          Promise.all(
            currentPositions.map(async (position) => {
              try {
                const posRes = await fetch(`/api/market-price?marketId=${position.marketId}`)
                if (posRes.ok) {
                  const posData = await posRes.json()
                  // Assume "Yes" is index 0
                  return { ...position, currentPrice: parseFloat(posData.outcomePrices[0]) }
                }
              } catch (e) {
                // Silent fail, keep old price
              }
              return position
            })
          ).then(updatedPositions => {
            setMultiOutcomePositions(updatedPositions)
            console.log(`🔄 Updated ${updatedPositions.length} multi-outcome prices`)
          })
        }
      } catch (e) {
        console.warn('Failed to refresh prices:', e)
      }
    }
    
    const interval = setInterval(refreshPrices, 15000) // Every 15 seconds
    return () => clearInterval(interval)
  }, [marketId, market])

  const fetchMarketDetails = async () => {
    try {
      setLoading(true)

      // 1. First try to find market in smart markets (has correct data)
      const smartMarketsRes = await fetch('/api/smart-markets')
      const smartMarkets = await smartMarketsRes.json()
      const smartMarket = smartMarkets.find((m: any) => m.marketId === marketId)
      
      let foundMarket = null
      
      if (smartMarket) {
        // Use eventSlug from database (fetched from Polymarket API by Worker)
        const dbEventSlug = (smartMarket as any).eventSlug
        
        // Fetch FRESH prices via our API (avoids CORS issues)
        let outcomes = ['Yes', 'No']
        let outcomePrices = ['0.5', '0.5']
        
        try {
          const priceRes = await fetch(`/api/market-price?marketId=${marketId}`)
          if (priceRes.ok) {
            const priceData = await priceRes.json()
            outcomes = priceData.outcomes
            outcomePrices = priceData.outcomePrices
            console.log(`✅ Fresh prices: ${outcomePrices.join(' / ')} (${(parseFloat(outcomePrices[0]) * 100).toFixed(1)}% / ${(parseFloat(outcomePrices[1]) * 100).toFixed(1)}%)`)
          }
        } catch (e) {
          console.warn('Failed to fetch fresh prices, using defaults')
        }
        
        // Use smart market data (has all needed fields)
        foundMarket = {
          id: smartMarket.marketId,
          question: smartMarket.question,
          slug: (smartMarket as any).marketSlug || null, // ✅ API returns 'marketSlug' not 'slug'
          eventSlug: dbEventSlug || null, // ✅ Add eventSlug to market object (same as Hot Markets!)
          category: smartMarket.category,
          volume: smartMarket.volume,
          liquidity: 0,
          outcomes,
          outcomePrices,
          endDate: smartMarket.endDate
        }
        
        // Set eventSlug state for legacy code (still used by eventInfo fetch)
        if (dbEventSlug) {
          setEventSlug(dbEventSlug)
          console.log(`✅ Event slug from DB: ${dbEventSlug}`)
        }
      } else {
        // Fallback: fetch from markets API
        const marketsRes = await fetch('/api/markets')
        const allMarkets = await marketsRes.json()
        foundMarket = allMarkets.find((m: any) => String(m.id) === String(marketId))
      }

      if (!foundMarket) {
        console.error('Market not found:', marketId)
        return
      }

      setMarket(foundMarket)

      // Try to find event slug (from DB or by searching Polymarket directly)
      let finalEventSlug = eventSlug || foundMarket.eventSlug
      
      console.log(`🔍 [${new Date().toISOString()}] Market ${marketId}: Looking for event slug...`)
      console.log(`   - eventSlug state: ${eventSlug}`)
      console.log(`   - foundMarket.eventSlug: ${foundMarket.eventSlug}`)
      
      // ALWAYS search Polymarket API via our proxy (avoids CORS)
      try {
        console.log(`📡 Fetching market ${marketId} via proxy...`)
        const polyMarketRes = await fetch(`/api/polymarket/markets/${marketId}`)
        if (polyMarketRes.ok) {
          const polyMarket = await polyMarketRes.json()
          console.log(`✅ Got market data. negRiskMarketID: ${polyMarket.negRiskMarketID}`)
          
          // If it's a neg-risk market (multi-outcome), find parent event
          if (polyMarket.negRiskMarketID) {
            console.log(`🔍 This is a neg-risk market! Searching for parent event...`)
            
            // Search through events to find matching one (increased limit for older events)
            const eventsRes = await fetch('/api/polymarket/events?limit=2000')
            if (eventsRes.ok) {
              const events = await eventsRes.json()
              console.log(`📊 Loaded ${events.length} events from Polymarket`)
              
              for (const event of events) {
                if (event.markets && Array.isArray(event.markets)) {
                  const hasMatch = event.markets.some((m: any) => 
                    String(m.id) === String(marketId) || 
                    m.negRiskMarketID === polyMarket.negRiskMarketID
                  )
                  if (hasMatch) {
                    finalEventSlug = event.slug
                    setEventSlug(finalEventSlug)
                    console.log(`✅✅✅ FOUND EVENT: "${event.title}" (${finalEventSlug})`)
                    console.log(`   - Event has ${event.markets.length} markets`)
                    break
                  }
                }
              }
              
              if (!finalEventSlug) {
                console.warn(`⚠️  No event found for market ${marketId}`)
              }
            }
          } else {
            console.log(`ℹ️  This is a binary market (no negRiskMarketID)`)
          }
        }
      } catch (error) {
        console.error('❌ Failed to search for event:', error)
      }

      // Fetch event info via proxy if we have event slug
      if (finalEventSlug) {
        try {
          console.log(`📡 Fetching event info for: ${finalEventSlug}`)
          const eventRes = await fetch(`/api/polymarket/events?slug=${finalEventSlug}`)
          if (eventRes.ok) {
            const events = await eventRes.json()
            const event = events && events[0]
            console.log(`✅ Got event: ${event ? event.title : 'null'}`)
            
            if (event && event.markets && event.markets.length > 0) {
              console.log(`📊 Event has ${event.markets.length} markets total`)
              
              // Parse all outcomes and sort by price (descending)
              const outcomes = event.markets
                .filter((m: any) => !m.closed) // Only active markets
                .map((m: any) => {
                  const price = m.outcomePrices && m.outcomePrices[0] 
                    ? parseFloat(m.outcomePrices[0]) 
                    : 0
                  const volume = m.volume ? parseFloat(m.volume) : 0
                  
                  return {
                    id: m.id,
                    question: m.question,
                    price,
                    volume
                  }
                })
                .sort((a: any, b: any) => b.price - a.price)
                .slice(0, 10) // Top 10
              
              console.log(`✅ Filtered to ${outcomes.length} active outcomes (top 10)`)
              
              if (outcomes.length > 0) {
                const eventData = {
                  eventSlug: event.slug,
                  eventTitle: event.title,
                  eventDescription: event.description || '',
                  eventImage: event.image || '',
                  totalVolume: parseFloat(event.volume || '0'),
                  topOutcomes: outcomes
                }
                
                setEventInfo(eventData)
                console.log(`✅✅✅ SET EVENT INFO: "${eventData.eventTitle}" with ${outcomes.length} outcomes`)
                console.log(`   Top 3 outcomes:`)
                outcomes.slice(0, 3).forEach((o: any, i: number) => {
                  console.log(`   ${i+1}. ${o.question} - ${(o.price * 100).toFixed(1)}%`)
                })
              } else {
                console.warn(`⚠️  No active outcomes found`)
              }
            } else {
              console.warn(`⚠️  Event has no markets`)
            }
          } else {
            console.error(`❌ Failed to fetch event info: ${eventRes.status}`)
          }
          
          // Still try to fetch smart trader positions from our API
          try {
            const multiRes = await fetch(`/api/multi-outcome-positions?eventSlug=${finalEventSlug}`)
            if (multiRes.ok) {
              const data = await multiRes.json()
              if (data.outcomes && data.outcomes.length > 0) {
                setMultiOutcomePositions(data.outcomes)
                console.log(`✅ Loaded ${data.outcomes.length} multi-outcome positions`)
              }
            }
          } catch (e) {
            console.warn('Could not fetch multi-outcome positions:', e)
          }
        } catch (error) {
          console.error('Failed to fetch event data:', error)
        }
      }

      // 2. Fetch REAL smart traders from smart-markets API
      try {
        const smartMarketsRes = await fetch('/api/smart-markets')
        if (smartMarketsRes.ok) {
          const smartMarkets = await smartMarketsRes.json()
          const thisMarket = smartMarkets.find((m: any) => m.marketId === marketId)
          
          if (thisMarket && thisMarket.topTraders && thisMarket.topTraders.length > 0) {
            // Fetch all traders to get real avatars
            const allTradersRes = await fetch('/api/traders')
            const allTraders = allTradersRes.ok ? await allTradersRes.json() : []
            
            const firstOutcome = (Array.isArray(foundMarket.outcomes) && foundMarket.outcomes.length > 0) 
              ? foundMarket.outcomes[0] 
              : 'YES'
            
            const realTraders: SmartTrader[] = thisMarket.topTraders.map((trader: any) => {
              // Find full trader data to get real avatar
              const fullTrader = allTraders.find((t: any) => 
                t.address.toLowerCase() === trader.address.toLowerCase()
              )
              
              // Use REAL position data from worker (side, shares, entryPrice)
              const outcome = trader.side || firstOutcome; // Use real side (YES/NO) from on-chain data
              const price = trader.entryPrice || 0.5;      // Use real entry price from market data
              const shares = trader.shares || 0;           // Real number of shares
              const amount = shares * price;               // Calculate real position size in $
              
              return {
                address: trader.address,
                displayName: trader.displayName,
                avatar: fullTrader?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${trader.address}`,
                tier: trader.tier,
                rarityScore: trader.rarityScore,
                outcome,  // ✅ REAL: YES or NO from on-chain
                price,    // ✅ REAL: entry price from market
                amount    // ✅ REAL: calculated from shares × price
              }
            })
            
            setSmartTraders(realTraders)
            console.log(`✅ Loaded ${realTraders.length} REAL smart traders for market ${marketId}`)
          } else {
            console.log('⚠️ No smart traders found for this market')
            setSmartTraders([])
          }
        }
      } catch (error) {
        console.error('Failed to fetch smart traders:', error)
        setSmartTraders([])
      }

    } catch (error) {
      console.error('Failed to fetch market details:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-white">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-primary font-bold">&gt; LOADING_MARKET_DATA...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-white">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">MARKET_NOT_FOUND</p>
          <Link href="/markets/smart" className="text-primary hover:text-primary/80">
            &lt; BACK_TO_SMART_MARKETS
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-white">
      {/* Back Button */}
      <Link 
        href="/markets/smart"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-bold">&lt; BACK_TO_ALPHA_MARKETS</span>
      </Link>

      {/* Market Header */}
      <div className="bg-card pixel-border border-purple-500/40 p-8 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="text-4xl">{eventInfo ? '🏆' : '🎯'}</div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">
                {eventInfo ? eventInfo.eventTitle : market.question}
              </h1>
              {eventInfo && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {eventInfo.eventDescription}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Category: <span className="text-primary">{market.category}</span>
                </span>
                <span className="text-muted-foreground">
                  Volume: <span className="text-green-500">
                    ${((eventInfo?.totalVolume || market.volume) / 1000000).toFixed(2)}M
                  </span>
                </span>
                {eventInfo && (
                  <span className="text-muted-foreground">
                    Outcomes: <span className="text-white">{eventInfo.topOutcomes.length} shown</span>
                  </span>
                )}
                {market.endDate && (
                  <span className="text-muted-foreground">
                    Ends: <span className="text-white">{new Date(market.endDate).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Polymarket Link - Same logic as Hot Markets! */}
          <a
            href={market?.eventSlug 
              ? `https://polymarket.com/event/${market.eventSlug}?via=01k` 
              : market?.slug
                ? `https://polymarket.com/market/${market.slug}?via=01k`
                : `https://polymarket.com?via=01k` // Ultimate fallback
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 px-4 py-2 pixel-border border-purple-500/50 transition-all font-bold text-sm whitespace-nowrap"
          >
            <ExternalLink className="h-4 w-4" />
            VIEW_ON_POLYMARKET
          </a>
        </div>
      </div>

      {/* Top Outcomes for Multi-Outcome Events */}
      {eventInfo && eventInfo.topOutcomes.length > 0 ? (
        <div className="bg-card pixel-border border-primary/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-6 w-6 text-primary alien-glow" />
            <h2 className="text-2xl font-bold text-primary">TOP_OUTCOMES</h2>
            <span className="text-xs text-muted-foreground">
              (sorted by probability)
            </span>
            <span className="flex items-center gap-1 text-xs text-primary/70 font-mono">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventInfo.topOutcomes.map((outcome, idx) => {
              const percentage = (outcome.price * 100).toFixed(1)
              const isTop3 = idx < 3
              
              return (
                <div
                  key={outcome.id}
                  className={`bg-black/40 pixel-border p-4 transition-all ${
                    isTop3 ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`px-2 py-1 text-xs font-bold pixel-border ${
                        idx === 0 ? 'bg-[#FFD700] text-black' :
                        idx === 1 ? 'bg-white text-black' :
                        idx === 2 ? 'bg-primary text-black' :
                        'bg-gray-600 text-white'
                      }`}>
                        #{idx + 1}
                      </span>
                      <h3 className={`text-sm font-bold flex-1 line-clamp-2 ${
                        isTop3 ? 'text-primary' : 'text-white'
                      }`}>
                        {outcome.question.replace(/^Will\s+/i, '').replace(/\s+(win|make|reach|qualify).*/i, '')}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <div className={`text-3xl font-bold mb-1 ${
                        isTop3 ? 'text-primary' : 'text-white'
                      }`}>
                        {percentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${(outcome.volume / 1000000).toFixed(2)}M volume
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-32">
                      <div className="w-full bg-black/60 h-2 pixel-border border-white/10 overflow-hidden">
                        <div 
                          className={`h-full ${isTop3 ? 'bg-primary' : 'bg-white/50'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Smart Money Outcomes - Multi-Outcome Markets */}
      {multiOutcomePositions.length > 0 ? (
        <div className="bg-card pixel-border border-[#FFD700]/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-6 w-6 text-[#FFD700] alien-glow" />
            <h2 className="text-2xl font-bold text-[#FFD700]">⭐ TOP_TRADER_POSITIONS</h2>
            <span className="text-xs text-muted-foreground">
              (ranked by S-tier conviction)
            </span>
            <span className="flex items-center gap-1 text-xs text-[#FFD700]/70 font-mono ml-auto">
              <span className="w-2 h-2 bg-[#FFD700] rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>

          <div className="space-y-4">
            {multiOutcomePositions.map((outcome, idx) => {
              const percentage = (outcome.currentPrice * 100).toFixed(1)
              const totalSharesK = (outcome.totalSmartShares / 1000).toFixed(1)
              const shortName = extractOutcomeShortName(outcome.outcomeTitle, multiOutcomePositions)
              const isTopPick = idx === 0 // First one has most S-tier traders
              const isExpanded = expandedOutcomes.has(idx)

              return (
                <div
                  key={idx}
                  className={`
                    bg-black/40 pixel-border p-6 transition-all relative
                    ${isTopPick 
                      ? 'border-[#FFD700] shadow-lg shadow-[#FFD700]/20 ring-2 ring-[#FFD700]/30' 
                      : 'border-[#FFD700]/30'
                    }
                  `}
                >
                  {/* TOP PICK Badge */}
                  {isTopPick && (
                    <div className="absolute -top-3 left-4 bg-[#FFD700] text-black px-3 py-1 text-xs font-bold pixel-border flex items-center gap-1">
                      <span>🏆</span>
                      <span>TOP_PICK</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <h3 
                      className={`
                        text-lg font-bold transition-colors flex-1 pr-4
                        ${isTopPick ? 'text-[#FFD700]' : 'text-white group-hover:text-[#FFD700]'}
                      `}
                      title={outcome.outcomeTitle}
                    >
                      {shortName}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">#{idx + 1}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {percentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Current Price
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[#FFD700] mb-1">
                        {outcome.smartTraderCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        S-Tier Traders
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary mb-1">
                        {totalSharesK}K
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Shares
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-black/60 h-2 pixel-border border-white/10 overflow-hidden mb-3">
                    <div 
                      className="h-full bg-gradient-to-r from-[#FFD700] to-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Top traders preview + Toggle button */}
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {outcome.smartPositions.slice(0, 5).map((pos, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded pixel-border border-[#FFD700] bg-black flex items-center justify-center text-xs font-bold text-[#FFD700]"
                          title={`${pos.traderName}: ${(pos.shares / 1000).toFixed(1)}K shares`}
                        >
                          {pos.tier}
                        </div>
                      ))}
                      {outcome.smartTraderCount > 5 && (
                        <div className="w-8 h-8 rounded pixel-border border-white/30 bg-black/60 flex items-center justify-center text-xs text-white/60">
                          +{outcome.smartTraderCount - 5}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => toggleOutcome(idx)}
                      className="px-4 py-2 pixel-border border-[#FFD700]/50 hover:border-[#FFD700] bg-black/40 hover:bg-[#FFD700]/10 text-[#FFD700] text-xs font-bold transition-all flex items-center gap-2"
                    >
                      {isExpanded ? '▲ HIDE' : '▼ SHOW'} TRADERS
                    </button>
                  </div>
                  
                  {/* Expanded Trader List */}
                  {isExpanded && outcome.smartPositions.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[#FFD700]/20 pt-4">
                      {outcome.smartPositions.map((pos, posIdx) => (
                        <Link
                          key={posIdx}
                          href={`/traders/${pos.traderAddress}`}
                          className="flex items-center justify-between p-3 bg-black/60 pixel-border border-white/10 hover:border-[#FFD700]/50 transition-all group"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`px-2 py-1 text-xs font-bold pixel-border ${
                              pos.tier === 'S' ? 'bg-[#FFD700] text-black' : 'bg-primary text-black'
                            }`}>
                              {pos.tier}
                            </div>
                            <span className="text-sm font-bold text-white group-hover:text-[#FFD700] transition-colors">
                              {pos.traderName}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-bold text-white">
                                {(pos.shares / 1000).toFixed(1)}K shares
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Entry: {(pos.entryPrice * 100).toFixed(1)}%
                              </div>
                            </div>
                            <div className={`px-2 py-1 text-xs font-bold pixel-border ${
                              pos.position === 'YES' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'
                            }`}>
                              {pos.position}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // Standard outcomes view for non-multi-outcome markets
        <div className="bg-card pixel-border border-primary/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-6 w-6 text-primary alien-glow" />
            <h2 className="text-2xl font-bold text-primary">CURRENT_ODDS</h2>
            {(() => {
              // Check if market is settled (100/0 or 0/100)
              const firstPrice = market.outcomePrices?.[0] ? parseFloat(market.outcomePrices[0]) : 0.5;
              const isSettled = firstPrice === 1 || firstPrice === 0;
              
              return isSettled ? (
                <span className="flex items-center gap-1 text-xs text-yellow-500 font-mono">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                  SETTLED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-primary/70 font-mono">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  LIVE
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Show event outcomes if multi-outcome, otherwise show binary YES/NO */}
            {eventInfo && eventInfo.topOutcomes && eventInfo.topOutcomes.length > 0 ? (
              // Multi-outcome event: Show teams/candidates
              eventInfo.topOutcomes.map((outcome: any, idx: number) => {
                const price = outcome.price || 0
                const percentage = (price * 100).toFixed(1)
                
                // Extract clean name from question (e.g., "Will Barcelona win?" -> "Barcelona")
                let cleanName = outcome.question
                const teamMatch = outcome.question.match(/Will\s+(?:the\s+)?(.+?)\s+(?:win|make|reach|qualify)/i)
                if (teamMatch) {
                  cleanName = teamMatch[1].trim()
                }

                return (
                  <div
                    key={outcome.id}
                    className="bg-black/40 pixel-border p-6 hover:scale-105 transition-all border-white/20 hover:border-primary"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-white">
                        {cleanName}
                      </h3>
                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                    </div>

                  <div className="mb-3">
                    <div className="text-4xl font-bold text-white mb-1">
                      {percentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${price.toFixed(4)} per share
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-black/60 h-2 pixel-border border-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                )
              })
            ) : (
              // Binary market: Try to extract team/player names, fallback to YES/NO
              (() => {
                // Try to extract sports team names from question
                const sportsOutcomes = extractSportsOutcomes(market.question)
                const displayOutcomes = sportsOutcomes || 
                  (Array.isArray(market.outcomes) ? market.outcomes : ['YES', 'NO'])
                
                return displayOutcomes.map((outcome, idx) => {
                  let price = 0.5
                  if (market.outcomePrices?.[idx]) {
                    const parsed = parseFloat(market.outcomePrices[idx])
                    price = isNaN(parsed) ? 0.5 : parsed
                  }
                  const percentage = (price * 100).toFixed(1)
                  const isYes = outcome.toLowerCase() === 'yes'
                  const isNo = outcome.toLowerCase() === 'no'

                  return (
                    <div
                      key={idx}
                      className={`bg-black/40 pixel-border p-6 hover:scale-105 transition-all ${
                        isYes ? 'border-green-500/50 hover:border-green-500' :
                        isNo ? 'border-red-500/50 hover:border-red-500' :
                        'border-white/20 hover:border-white/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-lg font-bold ${
                          isYes ? 'text-green-500' :
                          isNo ? 'text-red-500' :
                          'text-white'
                        }`}>
                          {outcome}
                        </h3>
                        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                      </div>

                    <div className="mb-3">
                      <div className="text-4xl font-bold text-white mb-1">
                        {percentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${price.toFixed(4)} per share
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-black/60 h-2 pixel-border border-white/10 overflow-hidden">
                      <div 
                        className={`h-full ${
                          isYes ? 'bg-green-500' :
                          isNo ? 'bg-red-500' :
                          'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  )
                })
              })()
            )}
          </div>
        </div>
      )}

      {/* Smart Money Positions */}
      <div className="bg-card pixel-border border-[#FFD700]/40 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-[#FFD700] alien-glow" />
          <h2 className="text-2xl font-bold text-[#FFD700]">SMART_MONEY_POSITIONS</h2>
          <span className="text-muted-foreground text-sm">
            {multiOutcomePositions.length > 0 
              ? `(${multiOutcomePositions.reduce((sum, o) => sum + o.smartTraderCount, 0)} S-tier traders across ${multiOutcomePositions.length} outcomes)`
              : `(${smartTraders.length} S/A traders)`
            }
          </span>
        </div>

        {multiOutcomePositions.length > 0 ? (
          // Multi-outcome detailed view
          <div className="space-y-6">
            {multiOutcomePositions.map((outcome, outcomeIdx) => {
              const shortName = extractOutcomeShortName(outcome.outcomeTitle, multiOutcomePositions)
              
              return (
              <div key={outcomeIdx} className="bg-black/20 pixel-border border-[#FFD700]/20 p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                  <h3 
                    className="text-lg font-bold text-[#FFD700]"
                    title={outcome.outcomeTitle}
                  >
                    {shortName}
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white">
                      {(outcome.currentPrice * 100).toFixed(1)}%
                    </span>
                    <span className="text-primary">
                      {(outcome.totalSmartShares / 1000).toFixed(1)}K shares
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {outcome.smartPositions.map((pos, posIdx) => (
                    <Link
                      key={posIdx}
                      href={`/traders/${pos.traderAddress}`}
                      className="block bg-black/40 pixel-border border-white/10 p-3 hover:border-[#FFD700] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Tier Badge */}
                        <div 
                          className="w-10 h-10 pixel-border flex items-center justify-center text-black font-bold flex-shrink-0"
                          style={{ backgroundColor: '#FFD700' }}
                        >
                          {pos.tier}
                        </div>

                        {/* Trader Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white group-hover:text-[#FFD700] transition-colors truncate">
                            {pos.traderName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {pos.traderAddress.slice(0, 10)}...{pos.traderAddress.slice(-8)}
                          </p>
                        </div>

                        {/* Position */}
                        <div className="text-right flex-shrink-0">
                          <div className="mb-1">
                            <span className={`px-2 py-1 pixel-border font-bold text-xs ${
                              pos.position === 'YES' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                            }`}>
                              {pos.position}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white">
                            {(pos.shares / 1000).toFixed(1)}K shares
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="text-muted-foreground">
                              Entry: {(pos.entryPrice * 100).toFixed(1)}%
                            </div>
                            <div className="text-primary">
                              Now: {(outcome.currentPrice * 100).toFixed(1)}%
                            </div>
                            {(() => {
                              const pnlPercent = ((outcome.currentPrice - pos.entryPrice) / pos.entryPrice * 100)
                              const pnlPositive = pnlPercent > 0
                              return (
                                <div className={pnlPositive ? 'text-green-400' : 'text-red-400'}>
                                  {pnlPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )})}
          </div>
        ) : smartTraders.length > 0 ? (
          (() => {
            // Group traders by outcome/team
            const groupedByOutcome = smartTraders.reduce((acc, trader) => {
              const outcome = trader.outcome || 'Unknown'
              if (!acc[outcome]) {
                acc[outcome] = []
              }
              acc[outcome].push(trader)
              return acc
            }, {} as Record<string, typeof smartTraders>)

            // If multiple outcomes, show grouped view
            if (Object.keys(groupedByOutcome).length > 1 || eventInfo) {
              return (
                <div className="space-y-6">
                  {Object.entries(groupedByOutcome).map(([outcome, traders]) => {
                    const teamName = outcome.toLowerCase() === 'yes' 
                      ? extractOutcomeShortName(market.question, [])
                      : outcome
                    
                    return (
                      <div key={outcome} className="bg-black/20 pixel-border border-[#FFD700]/20 p-4">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                          <h3 className="text-lg font-bold text-[#FFD700]">
                            {teamName || outcome}
                          </h3>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-primary">
                              {traders.length} {traders.length === 1 ? 'trader' : 'traders'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {traders.map((trader, idx) => (
                            <Link
                              key={idx}
                              href={`/traders/${trader.address}`}
                              className="block bg-black/40 pixel-border border-white/10 p-3 hover:border-[#FFD700] transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                {/* Tier Badge */}
                                <div 
                                  className="w-10 h-10 pixel-border flex items-center justify-center text-black font-bold flex-shrink-0"
                                  style={{ backgroundColor: trader.tier === 'S' ? '#FFD700' : '#00ff00' }}
                                >
                                  {trader.tier}
                                </div>

                                {/* Trader Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white group-hover:text-[#FFD700] transition-colors truncate">
                                    {trader.displayName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {trader.address.slice(0, 10)}...{trader.address.slice(-8)}
                                  </p>
                                </div>

                                {/* Position */}
                                <div className="text-right flex-shrink-0">
                                  <div className="text-xs space-y-0.5 mb-1">
                                    <div className="text-muted-foreground">
                                      Entry: {(trader.price * 100).toFixed(1)}%
                                    </div>
                                    {(market as any).currentOdds && (
                                      <>
                                        <div className="text-primary">
                                          Now: {((market as any).currentOdds * 100).toFixed(1)}%
                                        </div>
                                        {(() => {
                                          const currentPrice = trader.outcome.toLowerCase() === 'yes' 
                                            ? (market as any).currentOdds 
                                            : (1 - (market as any).currentOdds)
                                          const pnlPercent = ((currentPrice - trader.price) / trader.price * 100)
                                          const pnlPositive = pnlPercent > 0
                                          return (
                                            <div className={pnlPositive ? 'text-green-400' : 'text-red-400'}>
                                              {pnlPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                                            </div>
                                          )
                                        })()}
                                      </>
                                    )}
                                  </div>
                                  <div className="text-sm font-bold text-white">
                                    ${(trader.amount / 1000).toFixed(1)}K
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            // Fallback: flat list if only one outcome
            return (
              <div className="space-y-4">
                {smartTraders.map((trader, idx) => {
                  const tierColor = trader.tier === 'S' ? '#FFD700' : '#00ff00'
                  const isProfit = trader.outcome === (Array.isArray(market.outcomes) ? market.outcomes[0] : 'YES')

                  return (
                    <Link
                      key={idx}
                      href={`/traders/${trader.address}`}
                      className="block bg-black/40 pixel-border border-white/20 p-4 hover:border-[#FFD700] transition-all group"
                    >
                  <div className="flex items-center gap-4">
                    {/* Avatar & Tier */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={trader.avatar}
                        alt={trader.displayName}
                        className="w-16 h-16 rounded-lg pixel-border object-cover"
                        style={{ borderColor: tierColor, borderWidth: '2px' }}
                      />
                      <div 
                        className="absolute -top-2 -right-2 w-8 h-8 pixel-border flex items-center justify-center text-black font-bold text-sm"
                        style={{ backgroundColor: tierColor }}
                      >
                        {trader.tier}
                      </div>
                    </div>

                    {/* Trader Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-white text-lg group-hover:text-[#FFD700] transition-colors">
                          {trader.displayName}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Score: {(trader.rarityScore / 1000).toFixed(1)}K
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {trader.address.slice(0, 10)}...{trader.address.slice(-8)}
                      </p>
                    </div>

                    {/* Position Details */}
                    <div className="text-right">
                      <div className="mb-1">
                        <span className={`px-3 py-1 pixel-border font-bold text-sm ${
                          trader.outcome.toLowerCase() === 'yes' ? 'bg-green-500 text-black' :
                          trader.outcome.toLowerCase() === 'no' ? 'bg-red-500 text-white' :
                          'bg-primary text-black'
                        }`}>
                          {(() => {
                            // Extract team name from question for YES positions
                            if (trader.outcome.toLowerCase() === 'yes') {
                              const teamName = extractOutcomeShortName(market.question, [])
                              return teamName || trader.outcome
                            }
                            return trader.outcome
                          })()}
                        </span>
                      </div>
                      <div className="text-xs space-y-0.5 mb-1">
                        <div className="text-muted-foreground">
                          Entry: {((trader as any).entryPrice ? (trader as any).entryPrice * 100 : trader.price * 100).toFixed(1)}%
                        </div>
                        {(market as any).currentOdds && (
                          <>
                            <div className="text-primary">
                              Now: {((market as any).currentOdds * 100).toFixed(1)}%
                            </div>
                            {(() => {
                              const entryPrice = (trader as any).entryPrice || trader.price;
                              const currentPrice = trader.outcome.toLowerCase() === 'yes' 
                                ? (market as any).currentOdds 
                                : (1 - (market as any).currentOdds)
                              const pnlPercent = ((currentPrice - entryPrice) / entryPrice * 100)
                              const pnlPositive = pnlPercent > 0
                              return (
                                <div className={pnlPositive ? 'text-green-400' : 'text-red-400'}>
                                  {pnlPositive ? '+' : ''}{pnlPercent.toFixed(1)}%
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </div>
                      <div className="text-lg font-bold text-white">
                        ${(trader.amount / 1000).toFixed(1)}K
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
            )
          })()
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-mono">&gt; NO_SMART_TRADERS_DETECTED</p>
              <p className="text-xs mt-1">On-chain data analysis required</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 bg-card pixel-border border-primary/30 p-4">
        <p className="text-xs text-muted-foreground font-mono">
          ⚠️ NOTE: Smart trader positions are currently simulated. Real on-chain position tracking coming soon via Polymarket API integration.
        </p>
      </div>
    </div>
  )
}
