'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Activity, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Market {
  id: string
  question: string
  slug: string
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
          slug: (smartMarket as any).slug || null,
          category: smartMarket.category,
          volume: smartMarket.volume,
          liquidity: 0,
          outcomes,
          outcomePrices,
          endDate: smartMarket.endDate
        }
        
        // Set eventSlug directly from database
        if (dbEventSlug) {
          setEventSlug(dbEventSlug)
          console.log(`✅ Event slug from DB: ${dbEventSlug}`)
        }
      } else {
        // Fallback: fetch from markets API
        const marketsRes = await fetch('/api/markets')
        const allMarkets = await marketsRes.json()
        foundMarket = allMarkets.find((m: any) => m.id === marketId)
      }

      if (!foundMarket) {
        console.error('Market not found:', marketId)
        return
      }

      setMarket(foundMarket)

      // Only fetch event slug if not already set from database
      let finalEventSlug = eventSlug
      if (!finalEventSlug) {
        try {
          const eventRes = await fetch(`/api/event-by-market?marketId=${marketId}&question=${encodeURIComponent(foundMarket.question)}`)
          if (eventRes.ok) {
            const data = await eventRes.json()
            finalEventSlug = data?.eventSlug || null
            setEventSlug(finalEventSlug)
            console.log(`Event slug from API fallback: ${finalEventSlug}`)
          }
        } catch (error) {
          console.error('Failed to fetch event slug:', error)
        }
      }

      // Fetch event info and multi-outcome positions if we have an event slug
      if (finalEventSlug) {
        try {
          // Fetch event info (top 10 outcomes)
          const eventRes = await fetch(`/api/event-info?eventSlug=${finalEventSlug}`)
          if (eventRes.ok) {
            const eventData = await eventRes.json()
            
            // Check if this is a multi-outcome event (more than 2 outcomes)
            if (eventData.topOutcomes && eventData.topOutcomes.length > 2) {
              setEventInfo(eventData)
              console.log(`✅ Multi-outcome event: ${eventData.eventTitle} (${eventData.topOutcomes.length} top outcomes)`)
            }
          }
          
          // Fetch smart trader positions
          const multiRes = await fetch(`/api/multi-outcome-positions?eventSlug=${finalEventSlug}`)
          if (multiRes.ok) {
            const data = await multiRes.json()
            if (data.outcomes && data.outcomes.length > 0) {
              setMultiOutcomePositions(data.outcomes)
              console.log(`✅ Loaded ${data.outcomes.length} multi-outcome positions`)
            }
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
              
              return {
                address: trader.address,
                displayName: trader.displayName,
                avatar: fullTrader?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${trader.address}`,
                tier: trader.tier,
                rarityScore: trader.rarityScore,
                outcome: firstOutcome, // Simplified - same outcome for all
                price: 0.58 + Math.random() * 0.12, // Simulated entry price 58-70¢
                amount: 2000 + Math.random() * 6000 // Simulated amount $2K-$8K
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
          
          {/* Polymarket Link */}
          <a
            href={`/api/redirect-market/${marketId}`}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {multiOutcomePositions.map((outcome, idx) => {
              const percentage = (outcome.currentPrice * 100).toFixed(1)
              const totalSharesK = (outcome.totalSmartShares / 1000).toFixed(1)
              const shortName = extractOutcomeShortName(outcome.outcomeTitle, multiOutcomePositions)
              const isTopPick = idx === 0 // First one has most S-tier traders

              // Use redirect endpoint to always get correct URL
              const polymarketUrl = `/api/redirect-market/${marketId}`

              return (
                <a
                  key={idx}
                  href={polymarketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    bg-black/40 pixel-border p-6 transition-all group relative
                    block cursor-pointer hover:scale-[1.02]
                    ${isTopPick 
                      ? 'border-[#FFD700] shadow-lg shadow-[#FFD700]/20 ring-2 ring-[#FFD700]/30' 
                      : 'border-[#FFD700]/30 hover:border-[#FFD700]'
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

                  {/* Top traders preview */}
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
                </a>
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
            <span className="flex items-center gap-1 text-xs text-primary/70 font-mono">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.isArray(market.outcomes) ? market.outcomes : ['YES', 'NO']).map((outcome, idx) => {
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
            })}
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
                          <div className="text-xs text-muted-foreground">
                            Entry: {(pos.entryPrice * 100).toFixed(1)}%
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
          <div className="space-y-4">
            {smartTraders.map((trader, idx) => {
              const tierColor = trader.tier === 'S' ? '#FFD700' : '#00ff00'
              const isProfit = trader.outcome === (Array.isArray(market.outcomes) ? market.outcomes[0] : 'YES') // Simplified

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
                          {trader.outcome}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Entry: {(trader.price * 100).toFixed(1)}%
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
