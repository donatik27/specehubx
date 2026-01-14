'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  Users, 
  Store, 
  ArrowRight,
  Sparkles,
  Trophy,
  Target,
  Activity
} from 'lucide-react'
import MarketTicker from '@/components/MarketTicker'

interface Trader {
  address: string
  displayName: string
  avatar: string
  tier: string
  rarityScore: number
  estimatedPnL: number
}

interface SmartMarket {
  marketId: string
  question: string
  smartCount: number
  smartScore: number
}

export default function HomePage() {
  const [stats, setStats] = useState({
    totalTraders: 0,
    sTierTraders: 0,
    smartMarkets: 0
  })
  const [topTraders, setTopTraders] = useState<Trader[]>([])
  const [topMarkets, setTopMarkets] = useState<SmartMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    
    // Rotate traders every 5 seconds
    const interval = setInterval(() => {
      if (topTraders.length > 3) {
        setTopTraders(prev => {
          const rotated = [...prev]
          rotated.push(rotated.shift()!)
          return rotated
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      // Fetch traders
      const tradersRes = await fetch('/api/traders')
      const traders: Trader[] = await tradersRes.json()
      
      const sTierTraders = traders.filter(t => t.tier === 'S')
      
      setStats({
        totalTraders: traders.length,
        sTierTraders: sTierTraders.length,
        smartMarkets: 0 // Will update after smart markets fetch
      })
      
      // Shuffle and pick random S-tier traders
      const shuffled = [...sTierTraders].sort(() => Math.random() - 0.5)
      setTopTraders(shuffled.slice(0, 5))

      // Fetch smart markets
      const marketsRes = await fetch('/api/smart-markets')
      const markets: SmartMarket[] = await marketsRes.json()
      
      setTopMarkets(markets.slice(0, 3))
      setStats(prev => ({ ...prev, smartMarkets: markets.length }))
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-white">
      {/* Hero Section */}
      <div className="mb-12 relative">
        {/* Cosmic background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-10 w-1 h-1 bg-primary animate-pulse"></div>
          <div className="absolute top-8 right-20 w-1 h-1 bg-white animate-pulse"></div>
        </div>
        
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="text-4xl">🛸</div>
          <div>
            <h1 className="text-3xl font-bold text-primary alien-glow tracking-wider">
              SPACEHUB COMMAND CENTER
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              &gt; Polymarket Smart Money Tracker
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link 
          href="/traders"
          className="group bg-card pixel-border border-primary/40 p-6 hover:border-primary transition-all hover:scale-105"
        >
          <div className="flex items-center justify-between mb-3">
            <Users className="h-8 w-8 text-primary alien-glow" />
            <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-primary">TRADERS</h3>
          <p className="text-sm text-muted-foreground">&gt; View all traders</p>
        </Link>

        <Link 
          href="/markets/smart"
          className="group bg-card pixel-border border-purple-500/40 p-6 hover:border-purple-500 transition-all hover:scale-105"
        >
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="h-8 w-8 text-purple-400" />
            <ArrowRight className="h-5 w-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-purple-400">SMART MARKETS</h3>
          <p className="text-sm text-muted-foreground">&gt; Markets with smart money</p>
        </Link>

        <Link 
          href="/markets"
          className="group bg-card pixel-border border-white/40 p-6 hover:border-white transition-all hover:scale-105"
        >
          <div className="flex items-center justify-between mb-3">
            <Store className="h-8 w-8 text-white" />
            <ArrowRight className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-white">MARKETS</h3>
          <p className="text-sm text-muted-foreground">&gt; All Polymarket markets</p>
        </Link>

        <Link 
          href="/health"
          className="group bg-card pixel-border border-orange-500/40 p-6 hover:border-orange-500 transition-all hover:scale-105"
        >
          <div className="flex items-center justify-between mb-3">
            <Activity className="h-8 w-8 text-orange-400" />
            <ArrowRight className="h-5 w-5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-orange-400">SYSTEM HEALTH</h3>
          <p className="text-sm text-muted-foreground">&gt; System status</p>
        </Link>
      </div>

      {/* Stats Cards - WITHOUT Total Volume */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card pixel-border border-primary/40 p-6 hover:border-primary transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 text-6xl opacity-5">👥</div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <p className="text-xs font-mono text-primary uppercase tracking-wider">Total_Traders</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-4xl font-bold text-white mb-2 relative z-10">
            {loading ? '...' : stats.totalTraders}
          </p>
          <p className="text-xs text-muted-foreground font-mono">&gt; TRACKED_LIVE</p>
        </div>

        <div className="bg-card pixel-border border-[#FFD700]/40 p-6 hover:border-[#FFD700] transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 text-6xl opacity-5">🏆</div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <p className="text-xs font-mono text-[#FFD700] uppercase tracking-wider">S-Tier_Traders</p>
            <Trophy className="h-4 w-4 text-[#FFD700]" />
          </div>
          <p className="text-4xl font-bold text-[#FFD700] mb-2 relative z-10">
            {loading ? '...' : stats.sTierTraders}
          </p>
          <p className="text-xs text-muted-foreground font-mono">&gt; TOP_0.1%</p>
        </div>

        <div className="bg-card pixel-border border-purple-500/40 p-6 hover:border-purple-500 transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 text-6xl opacity-5">🎯</div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <p className="text-xs font-mono text-purple-400 uppercase tracking-wider">Smart_Markets</p>
            <Target className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-4xl font-bold text-purple-400 mb-2 relative z-10">
            {loading ? '...' : stats.smartMarkets > 0 ? '10+' : '0'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">&gt; WITH_S/A_TRADERS</p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top S-Tier Traders */}
        <div className="bg-card pixel-border border-primary/40 p-6 hover:border-primary transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#FFD700]" />
              <h2 className="text-xl font-bold text-[#FFD700]">TOP S-TIER TRADERS</h2>
            </div>
            <Link 
              href="/traders?tier=S"
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-mono"
            >
              ALL_&gt;
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <div className="animate-spin text-2xl mb-2">⏳</div>
                  <p className="text-sm font-mono">&gt; LOADING...</p>
                </div>
              </div>
            ) : topTraders.length > 0 ? (
              topTraders.slice(0, 3).map((trader) => (
                <Link
                  key={trader.address}
                  href={`/traders/${trader.address}`}
                  className="flex items-center gap-3 p-3 bg-black/40 pixel-border border-white/20 hover:border-[#FFD700] transition-all group"
                >
                  <img
                    src={trader.avatar}
                    alt={trader.displayName}
                    className="w-12 h-12 rounded-full bg-secondary object-cover pixel-border border-[#FFD700]"
                    onError={(e) => {
                      e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{trader.displayName}</p>
                    <p className="text-xs text-primary font-mono">SCORE: {Math.round(trader.rarityScore / 1000)}k</p>
                  </div>
                  <span className="px-2 py-1 bg-[#FFD700] text-black text-xs font-bold pixel-border">
                    S
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-mono">&gt; NO_DATA</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Smart Markets */}
        <div className="bg-card pixel-border border-primary/40 p-6 hover:border-primary transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold text-purple-400">TOP SMART MARKETS</h2>
            </div>
            <Link 
              href="/markets/smart"
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-mono"
            >
              ALL_&gt;
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <div className="animate-spin text-2xl mb-2">⏳</div>
                  <p className="text-sm font-mono">&gt; LOADING...</p>
                </div>
              </div>
            ) : topMarkets.length > 0 ? (
              topMarkets.map((market, idx) => (
                <Link
                  key={market.marketId}
                  href={`/markets/smart`}
                  className="block p-4 bg-black/40 pixel-border border-white/20 hover:border-purple-500 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="px-3 py-1 bg-purple-500 text-white text-xs font-bold pixel-border flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
                        {market.question}
                      </p>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-purple-400">
                          SCORE: {Math.round(market.smartScore)}
                        </span>
                        <span className="text-primary">
                          {market.smartCount} S/A TRADERS
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-mono">&gt; NO_DATA</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Development Roadmap */}
      <div className="mt-8 mb-12 bg-card pixel-border border-primary/40 p-6">
        <div className="mb-6">
          <h3 className="font-bold text-primary text-xl mb-2 font-mono">🛸 DEVELOPMENT_ROADMAP</h3>
          <p className="text-xs text-muted-foreground font-mono">&gt; Tracking project evolution phases</p>
        </div>

        {/* Phases Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Phase 1 - Completed */}
          <div className="bg-primary/10 pixel-border border-primary/50 p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-xl">✅</div>
            <h4 className="font-bold text-primary mb-1 font-mono line-through">PHASE_1: CORE_INFRASTRUCTURE</h4>
            <p className="text-xs text-muted-foreground font-mono mb-2">&gt; Database, API, UI framework setup</p>
            <div className="text-xs font-mono text-primary/60">STATUS: COMPLETED</div>
          </div>

          {/* Phase 2 - Current (Active) */}
          <div className="bg-primary/20 pixel-border border-primary p-4 relative overflow-hidden alien-glow">
            <div className="absolute top-2 right-2 text-2xl animate-pulse">🔄</div>
            <h4 className="font-bold text-primary mb-1 font-mono">PHASE_2: MAIN_FEATURES 🎯</h4>
            <p className="text-xs text-muted-foreground font-mono mb-2">&gt; Trader tracking, Smart Markets, On-chain data</p>
            <div className="text-xs font-mono text-primary font-bold">STATUS: ACTIVE_NOW</div>
          </div>

          {/* Phase 3 - Upcoming */}
          <div className="bg-purple-500/10 pixel-border border-purple-500/50 p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-2xl animate-pulse">💫</div>
            <h4 className="font-bold text-purple-400 mb-1 font-mono">PHASE_3: ADVANCED_ANALYTICS</h4>
            <p className="text-xs text-muted-foreground font-mono mb-2">&gt; Historical data, Performance charts, Correlations</p>
            <div className="text-xs font-mono text-purple-400/60">STATUS: COMING_SOON</div>
          </div>

          {/* Phase 4 - Future */}
          <div className="bg-blue-500/10 pixel-border border-blue-500/50 p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-2xl animate-pulse">🚀</div>
            <h4 className="font-bold text-blue-400 mb-1 font-mono">PHASE_4: AI_PREDICTIONS</h4>
            <p className="text-xs text-muted-foreground font-mono mb-2">&gt; Smart alerts, Pattern recognition, Auto-discovery</p>
            <div className="text-xs font-mono text-blue-400/60">STATUS: FUTURE_PLAN</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-primary/20">
          <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Powered by <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Polymarket</a> data</span>
          </div>
          <Link 
            href="/health"
            className="text-xs bg-primary/20 hover:bg-primary/30 px-3 py-1 pixel-border border-primary/50 transition-colors font-mono"
          >
            CHECK_STATUS
          </Link>
        </div>
      </div>

      {/* Hot Markets Ticker */}
      <MarketTicker />
    </div>
  )
}
