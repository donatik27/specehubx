'use client'
// KILLER TRADER PROFILE - Radar Charts + Bubble Chart! 🔥

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Activity, Wallet } from 'lucide-react'
import Link from 'next/link'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell } from 'recharts'

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

interface Trade {
  id: string
  timestamp: number
  title: string
  outcome: string
  side: string
  size: number
  price: number
  buyPrice: number
  sellPrice: number
  profit?: number
  category: string
}

interface ActivityStats {
  lastTrade: number | null
  totalTrades: number
  activeDays: number
  categoryBreakdown: {
    category: string
    count: number
    volume: number
    percentage: number
  }[]
  trades?: Trade[]
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
        
        // Fetch activity (includes trades) from Railway API
        const activityRes = await fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
        
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
      
      // Fetch activity for leaderboard traders too
      const activityRes = await fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
      
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

  // Calculate radar chart data for Most Traded Categories
  const getMostTradedCategories = () => {
    if (!activity?.categoryBreakdown) return []
    
    const categories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
    const dataMap = new Map(activity.categoryBreakdown.map(c => [c.category, c.count]))
    
    return categories.map(cat => ({
      category: cat,
      value: dataMap.get(cat) || 0
    }))
  }

  // Calculate Win Rate by Category (from trades)
  const getWinRateByCategory = () => {
    if (!activity?.trades) return []
    
    const categories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
    const categoryStats = new Map<string, { wins: number; total: number }>()
    
    activity.trades.forEach(trade => {
      if (trade.profit !== undefined) {
        const stats = categoryStats.get(trade.category) || { wins: 0, total: 0 }
        stats.total++
        if (trade.profit > 0) stats.wins++
        categoryStats.set(trade.category, stats)
      }
    })
    
    return categories.map(cat => {
      const stats = categoryStats.get(cat)
      const winRate = stats ? (stats.wins / stats.total) : 0
      return {
        category: cat,
        value: winRate * 100 // 0-100 scale
      }
    })
  }

  // Get finished trades for bubble chart
  const getFinishedTrades = () => {
    if (!activity?.trades) return []
    
    return activity.trades
      .filter(t => t.profit !== undefined)
      .map(t => ({
        buyPrice: t.buyPrice * 100, // Convert to cents (0-100)
        sellPrice: t.sellPrice * 100, // Convert to cents (0-100)
        profit: t.profit || 0,
        size: Math.max(50, Math.abs(t.profit || 0)), // Bubble size (min 50 for visibility)
        category: t.category
      }))
      .slice(0, 50) // Show last 50 finished trades
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total PnL */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Total_PnL</p>
          </div>
          <p className={`text-2xl font-bold ${trader.estimatedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trader.estimatedPnL >= 0 ? '+' : ''}{formatCurrency(trader.estimatedPnL)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Monthly earnings</p>
        </div>

        {/* Total Trades */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Total_Trades</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {activity?.totalTrades || trader.tradeCount || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
        </div>

        {/* Volume */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Volume</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {activity && activity.categoryBreakdown.length > 0
              ? formatCurrency(activity.categoryBreakdown.reduce((sum, cat) => sum + cat.volume, 0))
              : formatCurrency(trader.volume || 0)
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activity && activity.categoryBreakdown.length > 0 ? 'Last 100 trades' : 'Estimated'}
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

      {/* Trading Analytics - 3 Radar Charts */}
      {activity && activity.categoryBreakdown.length > 0 && (
        <div className="bg-card pixel-border border-purple-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-purple-400">TRADING_ANALYTICS</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Most Traded Categories */}
            <div className="bg-black/40 pixel-border border-white/20 p-4">
              <h3 className="text-sm font-bold text-white mb-4 text-center">Most Traded Categories</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={getMostTradedCategories()}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#888', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fill: '#666', fontSize: 10 }} />
                  <Radar name="Trades" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Smart Score by Category */}
            <div className="bg-black/40 pixel-border border-white/20 p-4 relative">
              <h3 className="text-sm font-bold text-white mb-4 text-center">Smart Score by Category</h3>
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border-2 border-orange-500 pixel-border">
                    <span className="text-2xl">🔒</span>
                    <span className="text-orange-400 font-bold">Pro Only</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={getMostTradedCategories()}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#888', fontSize: 11 }} />
                  <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Win Rate by Category */}
            <div className="bg-black/40 pixel-border border-white/20 p-4">
              <h3 className="text-sm font-bold text-white mb-4 text-center">Win Rate by Category</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={getWinRateByCategory()}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#888', fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }} />
                  <Radar name="Win %" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown - Compact */}
      {activity && activity.categoryBreakdown.length > 0 && (
        <div className="bg-card pixel-border border-cyan-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold text-cyan-400">CATEGORY_BREAKDOWN</h2>
            <span className="text-muted-foreground text-xs">(Last 100 trades)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {activity.categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="bg-black/40 pixel-border border-white/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">{cat.category}</p>
                <p className="text-lg font-bold text-cyan-400">{cat.count}</p>
                <p className="text-xs text-muted-foreground">{cat.percentage.toFixed(0)}% of trades</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished Trades Chart */}
      {activity && activity.trades && activity.trades.length > 0 && (
        <div className="bg-card pixel-border border-cyan-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-cyan-400">FINISHED_TRADES: 🍉 CHART</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Trades in the <span className="text-green-500">■</span> green area are profitable, while those in the <span className="text-red-500">■</span> red area are losses. Circle size represents the trade's dollar value.
          </p>
          
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              
              <XAxis 
                type="number" 
                dataKey="buyPrice" 
                name="Buy Price" 
                label={{ value: 'Buy Price', position: 'bottom', fill: '#888' }}
                stroke="#666"
                domain={[0, 100]}
              />
              <YAxis 
                type="number" 
                dataKey="sellPrice" 
                name="Sell Price"
                label={{ value: 'Sell Price', angle: -90, position: 'left', fill: '#888' }}
                stroke="#666"
                domain={[0, 100]}
              />
              <ZAxis type="number" dataKey="size" range={[20, 400]} />
              
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-black/90 border border-white/20 p-3 pixel-border">
                        <p className="text-white font-bold mb-1">{data.category}</p>
                        <p className="text-xs text-muted-foreground">Buy: {data.buyPrice.toFixed(1)}¢</p>
                        <p className="text-xs text-muted-foreground">Sell: {data.sellPrice.toFixed(1)}¢</p>
                        <p className={`text-sm font-bold ${data.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(0)}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              
              {/* Profit zone (above diagonal) */}
              <rect x="0" y="0" width="100%" height="50%" fill="url(#profitGradient)" opacity={0.1} />
              
              {/* Loss zone (below diagonal) */}
              <rect x="0" y="50%" width="100%" height="50%" fill="url(#lossGradient)" opacity={0.1} />
              
              {/* Diagonal line (break-even) */}
              <line x1="0" y1="100%" x2="100%" y2="0" stroke="#666" strokeWidth={2} strokeDasharray="5,5" />
              
              <Scatter name="Trades" data={getFinishedTrades()} fill="#8884d8">
                {getFinishedTrades().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Activity Timeline - Last Trade Only */}
      {activity && activity.lastTrade && (
        <div className="bg-card pixel-border border-yellow-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-6 w-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-yellow-400">ACTIVITY_TIMELINE</h2>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-6">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Last Trade</p>
            <p className="text-2xl font-bold text-white">
              {new Date(activity.lastTrade * 1000).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {(() => {
                const hoursAgo = Math.floor((Date.now() - activity.lastTrade * 1000) / (1000 * 60 * 60));
                if (hoursAgo < 1) {
                  const minsAgo = Math.floor((Date.now() - activity.lastTrade * 1000) / (1000 * 60));
                  return `${minsAgo} minutes ago`;
                }
                if (hoursAgo < 24) return `${hoursAgo} hours ago`;
                const daysAgo = Math.floor(hoursAgo / 24);
                return `${daysAgo} days ago`;
              })()}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
