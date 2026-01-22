'use client'
// Force Vercel rebuild - added Category Breakdown & Activity Timeline!

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Target, Activity, Wallet } from 'lucide-react'
import Link from 'next/link'

interface Trader {
  address: string
  displayName: string
  avatar: string
  tier: string
  rarityScore: number
  estimatedPnL: number
  volume: number
  winRate: number
  tradeCount: number
  verified: boolean
  xUsername?: string
}

interface Position {
  marketId: string
  question: string
  outcome: string
  shares: number
  avgPrice: number
  currentPrice: number
  unrealizedPnL: number
  value: number
  category?: string
  image?: string
}

interface ActivityStats {
  lastTrade: string | null
  totalTrades: number
  activeDays: number
  categoryBreakdown: {
    category: string
    count: number
    volume: number
    percentage: number
  }[]
}

// Format currency in a clear way
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    // Millions: $3.18M
    return `$${(value / 1000000).toFixed(2)}M`
  } else if (Math.abs(value) >= 1000) {
    // Thousands: $175K
    return `$${(value / 1000).toFixed(0)}K`
  } else {
    // Under 1000: $500
    return `$${value.toFixed(0)}`
  }
}

export default function TraderProfilePage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const [trader, setTrader] = useState<Trader | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [activity, setActivity] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Railway API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://adorable-grace-production-e919.up.railway.app'

  useEffect(() => {
    fetchTraderData()
  }, [address])

  const fetchTraderData = async () => {
    try {
      setLoading(true)

      // Try to fetch trader directly from database by address
      const traderRes = await fetch(`/api/trader/${address}`)
      
      if (traderRes.ok) {
        const foundTrader: Trader = await traderRes.json()
        setTrader(foundTrader)
        
        // Fetch positions and activity in parallel from Railway API
        const [positionsRes, activityRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/trader/${address}/positions`),
          fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
        ])
        
        if (positionsRes.ok) {
          const positionsData = await positionsRes.json()
          setPositions(positionsData)
        }
        
        if (activityRes.ok) {
          const activityData = await activityRes.json()
          setActivity(activityData)
        }
        
        return
      }
      
      // Fallback: try to find in monthly leaderboard (top 1000)
      const tradersRes = await fetch('/api/traders')
      const allTraders: Trader[] = await tradersRes.json()
      
      const foundTrader = allTraders.find(t => t.address.toLowerCase() === address.toLowerCase())
      
      if (!foundTrader) {
        console.error('Trader not found in database or leaderboard')
        return
      }

      setTrader(foundTrader)
      
      // Fetch positions and activity for leaderboard traders too from Railway API
      const [positionsRes, activityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/trader/${address}/positions`),
        fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
      ])
      
      if (positionsRes.ok) {
        const positionsData = await positionsRes.json()
        setPositions(positionsData)
      }
      
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivity(activityData)
      }
      
    } catch (error) {
      console.error('Failed to fetch trader data:', error)
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
            <p className="text-primary font-bold">&gt; LOADING_TRADER_PROFILE...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!trader) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-white">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">TRADER_NOT_FOUND</p>
          <Link href="/traders" className="text-primary hover:text-primary/80">
            &lt; BACK_TO_TRADERS
          </Link>
        </div>
      </div>
    )
  }

  const tierColor = {
    S: '#FFD700',
    A: '#00ff00',
    B: '#00aaff',
    C: '#ffffff',
    D: '#888888',
    E: '#444444'
  }[trader.tier] || '#ffffff'

  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0)
  const totalPositionValue = positions.reduce((sum, p) => sum + p.value, 0)

  // Generate WHY TIER explanation
  const generateTierExplanation = (): string[] => {
    const reasons: string[] = []
    
    if (trader.tier === 'S') {
      // Check if public figure
      if (trader.xUsername || trader.verified) {
        reasons.push(`✓ PUBLIC_FIGURE: Verified trader with Twitter presence (@${trader.xUsername || 'verified'})`)
      }
      
      // High PnL
      if (trader.estimatedPnL > 50000) {
        reasons.push(`✓ ELITE_PROFITS: ${formatCurrency(trader.estimatedPnL)}+ total PnL (top 0.1%)`)
      }
      
      // High Volume (experience)
      if (trader.volume > 500000) {
        reasons.push(`✓ HIGH_VOLUME: ${formatCurrency(trader.volume)}+ traded (experienced trader)`)
      }
      
      // Win Rate
      if (trader.winRate > 0.55) {
        reasons.push(`✓ WINNING_EDGE: ${(trader.winRate * 100).toFixed(1)}% win rate (consistent profitability)`)
      }
      
      // High Score
      if (trader.rarityScore > 60000) {
        const scoreDisplay = trader.rarityScore >= 1000 
          ? `${(trader.rarityScore / 1000).toFixed(1)}K` 
          : trader.rarityScore.toString()
        reasons.push(`✓ TOP_PERFORMER: Rarity score ${scoreDisplay}+ (elite tier)`)
      }
    } else if (trader.tier === 'A') {
      reasons.push(`✓ Strong PnL: ${formatCurrency(trader.estimatedPnL)} monthly profit`)
      reasons.push(`✓ Active trader: ${trader.tradeCount}+ trades with ${(trader.winRate * 100).toFixed(1)}% win rate`)
      reasons.push(`✓ High volume: Proven track record with significant trading activity`)
    } else if (trader.tier === 'B') {
      reasons.push(`✓ Solid performance: Consistent profitable trading`)
      reasons.push(`✓ Growing portfolio: Building experience and volume`)
    }
    
    return reasons
  }

  const tierReasons = generateTierExplanation()

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-white">
      {/* Back Button */}
      <Link 
        href="/traders"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-bold">&lt; BACK_TO_TRADERS</span>
      </Link>

      {/* Header - Trader Info */}
      <div className="bg-card pixel-border border-primary/40 p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={trader.avatar}
              alt={trader.displayName}
              className="w-32 h-32 rounded-lg pixel-border object-cover"
              style={{ borderColor: tierColor, borderWidth: '3px' }}
              onError={(e) => {
                e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
              }}
            />
            {/* Tier Badge */}
            <div 
              className="absolute -top-3 -right-3 w-12 h-12 pixel-border flex items-center justify-center text-black font-bold text-xl"
              style={{ backgroundColor: tierColor }}
            >
              {trader.tier}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{trader.displayName}</h1>
              {trader.verified && (
                <span className="text-primary text-xl">✓</span>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm mb-4 font-mono">
              {trader.address.slice(0, 10)}...{trader.address.slice(-8)}
            </p>

            {trader.xUsername && (
              <a
                href={`https://twitter.com/${trader.xUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm mb-4"
              >
                <span>𝕏 @{trader.xUsername}</span>
              </a>
            )}

            {/* Quick Stats */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: tierColor }} />
                <span className="text-sm">
                  SCORE: <span className="font-bold">
                    {trader.rarityScore >= 1000 
                      ? `${(trader.rarityScore / 1000).toFixed(1)}K` 
                      : trader.rarityScore.toFixed(0)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm">
                  TRADES: <span className="font-bold">{trader.tradeCount}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Polymarket Profile Button */}
          <div className="flex-shrink-0">
            <a
              href={`https://polymarket.com/profile/${trader.address}?via=01k`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold pixel-border border-purple-400 transition-all group"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider opacity-80">View on</div>
                <div className="text-sm font-bold">POLYMARKET</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total PnL */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Total_PnL</p>
          </div>
          <p className={`text-2xl font-bold ${trader.estimatedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trader.estimatedPnL >= 0 ? '+' : ''}{formatCurrency(trader.estimatedPnL)}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Win_Rate</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {(trader.winRate * 100).toFixed(1)}%
          </p>
        </div>

        {/* Volume */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Volume</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(trader.volume)}
          </p>
        </div>

        {/* Unrealized PnL */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            {totalUnrealizedPnL >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <p className="text-xs text-muted-foreground uppercase">Unrealized_PnL</p>
          </div>
          <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnL)}
          </p>
        </div>
      </div>

      {/* WHY TIER S/A/B? */}
      {tierReasons.length > 0 && (
        <div className="bg-card pixel-border p-6 mb-6" style={{ borderColor: tierColor, borderWidth: '2px' }}>
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-6 w-6" style={{ color: tierColor }} />
            <h2 className="text-2xl font-bold" style={{ color: tierColor }}>
              WHY_TIER_{trader.tier}?
            </h2>
          </div>
          
          <div className="space-y-3">
            {tierReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-primary font-bold text-lg flex-shrink-0">▸</span>
                <p className="text-white text-sm font-mono leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-muted-foreground font-mono">
              &gt; TIER_ANALYSIS_BASED_ON: Monthly PnL • Volume • Win Rate • Consistency • Public Profile
            </p>
          </div>
        </div>
      )}

      {/* Monthly Stats Summary */}
      <div className="bg-card pixel-border border-purple-500/40 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold text-purple-400">MONTHLY_PERFORMANCE</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">PnL This Month</p>
            <p className={`text-3xl font-bold ${trader.estimatedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trader.estimatedPnL >= 0 ? '+' : ''}{formatCurrency(trader.estimatedPnL)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">From Polymarket leaderboard</p>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Win Rate</p>
            <p className="text-3xl font-bold text-white">
              {(trader.winRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Estimated from volume/PnL</p>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Total Trades</p>
            <p className="text-3xl font-bold text-primary">
              {trader.tradeCount || '~'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Activity level</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {activity && activity.categoryBreakdown.length > 0 && (
        <div className="bg-card pixel-border border-cyan-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold text-cyan-400">CATEGORY_BREAKDOWN</h2>
            <span className="text-muted-foreground text-sm">
              (Last 100 trades)
            </span>
          </div>

          <div className="space-y-3">
            {activity.categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="bg-black/40 pixel-border border-white/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">{cat.category}</span>
                    <span className="text-sm text-muted-foreground">
                      {cat.count} trades
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-cyan-400">
                      {formatCurrency(cat.volume)}
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-black/60 h-2 pixel-border border-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{cat.percentage.toFixed(1)}% of trades</span>
                  <span>Avg: {formatCurrency(cat.volume / cat.count)} per trade</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {activity && (
        <div className="bg-card pixel-border border-yellow-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-yellow-400">ACTIVITY_TIMELINE</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Last Trade */}
            <div className="bg-black/40 pixel-border border-white/20 p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Last Trade</p>
              <p className="text-xl font-bold text-white">
                {activity.lastTrade 
                  ? new Date(activity.lastTrade).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'No recent trades'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activity.lastTrade 
                  ? `${Math.floor((Date.now() - new Date(activity.lastTrade).getTime()) / (1000 * 60 * 60))}h ago`
                  : 'N/A'
                }
              </p>
            </div>

            {/* Total Trades */}
            <div className="bg-black/40 pixel-border border-white/20 p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Recent Trades</p>
              <p className="text-xl font-bold text-yellow-400">
                {activity.totalTrades}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Last 100 tracked</p>
            </div>

            {/* Active Days */}
            <div className="bg-black/40 pixel-border border-white/20 p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase">Active Days</p>
              <p className="text-xl font-bold text-yellow-400">
                {activity.activeDays}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activity.totalTrades > 0 
                  ? `Avg ${(activity.totalTrades / activity.activeDays).toFixed(1)} trades/day`
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Open Positions */}
      <div className="bg-card pixel-border border-primary/40 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Target className="h-6 w-6 text-primary alien-glow" />
          <h2 className="text-2xl font-bold text-primary">TOP_POSITIONS</h2>
          <span className="text-muted-foreground text-sm">
            (Top 3 by volume)
          </span>
        </div>

        {positions.length > 0 ? (
          <div className="space-y-4">
            {positions.map((position, idx) => (
              <div
                key={idx}
                className="bg-black/40 pixel-border border-white/20 p-4 hover:border-primary transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-bold mb-2">{position.question}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 pixel-border font-bold ${
                        position.outcome === 'YES' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                      }`}>
                        {position.outcome}
                      </span>
                      <span className="text-muted-foreground">
                        {position.shares} shares @ {(position.avgPrice * 100).toFixed(0)}¢
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-xl font-bold ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Value: ${position.value.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Entry: {(position.avgPrice * 100).toFixed(0)}¢</span>
                  <span>Current: {(position.currentPrice * 100).toFixed(0)}¢</span>
                  <span className={position.currentPrice > position.avgPrice ? 'text-green-500' : 'text-red-500'}>
                    {position.currentPrice > position.avgPrice ? '↗' : '↘'} 
                    {Math.abs(((position.currentPrice - position.avgPrice) / position.avgPrice) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-mono mb-2">&gt; POSITIONS_DATA_NOT_AVAILABLE</p>
              <p className="text-xs text-muted-foreground">
                Real-time positions require Polymarket API integration
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
