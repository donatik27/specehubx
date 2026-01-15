'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Activity, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Market {
  id: string
  question: string
  category: string
  volume: number
  liquidity: number
  outcomes: string[]
  outcomePrices: string[]
  endDate: string
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

export default function SmartMarketDetailPage() {
  const params = useParams()
  const marketId = params.marketId as string

  const [market, setMarket] = useState<Market | null>(null)
  const [smartTraders, setSmartTraders] = useState<SmartTrader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMarketDetails()
  }, [marketId])

  const fetchMarketDetails = async () => {
    try {
      setLoading(true)

      // 1. Fetch market details
      const marketsRes = await fetch('/api/markets')
      const allMarkets = await marketsRes.json()
      const foundMarket = allMarkets.find((m: any) => m.id === marketId)

      if (!foundMarket) {
        console.error('Market not found')
        return
      }

      setMarket(foundMarket)

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
            <div className="text-4xl">🎯</div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">{market.question}</h1>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Category: <span className="text-primary">{market.category}</span>
                </span>
                <span className="text-muted-foreground">
                  Volume: <span className="text-green-500">${(market.volume / 1000000).toFixed(2)}M</span>
                </span>
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
            href={`https://polymarket.com/event/${marketId}?via=01k`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 px-4 py-2 pixel-border border-purple-500/50 transition-all font-bold text-sm whitespace-nowrap"
          >
            <ExternalLink className="h-4 w-4" />
            VIEW_ON_POLYMARKET
          </a>
        </div>
      </div>

      {/* Outcomes & Prices */}
      <div className="bg-card pixel-border border-primary/40 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-6 w-6 text-primary alien-glow" />
          <h2 className="text-2xl font-bold text-primary">CURRENT_ODDS</h2>
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
                    {percentage}¢
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${(price * 1).toFixed(2)} per share
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

      {/* Smart Money Positions */}
      <div className="bg-card pixel-border border-[#FFD700]/40 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-[#FFD700] alien-glow" />
          <h2 className="text-2xl font-bold text-[#FFD700]">SMART_MONEY_POSITIONS</h2>
          <span className="text-muted-foreground text-sm">
            ({smartTraders.length} S/A traders)
          </span>
        </div>

        {smartTraders.length > 0 ? (
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
                        Entry: {(trader.price * 100).toFixed(0)}¢
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
