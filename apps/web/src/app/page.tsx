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
import SiteMapNeural from '@/components/SiteMapNeural'

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
      
      // Filter for traders with REAL avatars (media personalities)
      // Exclude DiceBear generated avatars - only show traders with profile pictures
      // Also exclude traders with 0 or missing rarityScore
      const tradersWithRealAvatars = sTierTraders.filter(t => 
        t.avatar && 
        !t.avatar.includes('dicebear.com') &&
        t.rarityScore > 0
      )
      
      setStats({
        totalTraders: traders.length,
        sTierTraders: sTierTraders.length,
        smartMarkets: 0 // Will update after smart markets fetch
      })
      
      // Shuffle and pick random S-tier traders WITH REAL AVATARS
      const shuffled = [...tradersWithRealAvatars].sort(() => Math.random() - 0.5)
      setTopTraders(shuffled.slice(0, 10)) // More traders to fill the space

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
          href="/map"
          className="group bg-card pixel-border border-primary/40 p-6 hover:border-primary transition-all hover:scale-105 relative overflow-hidden bg-black/60"
        >
          {/* EPIC Animated Radar - LOWER POSITION */}
          <div className="absolute bottom-0 right-0 flex items-center justify-center" style={{ width: '180px', height: '180px' }}>
            <svg width="180" height="180" viewBox="0 0 200 200" className="absolute group-hover:scale-110 transition-transform duration-500">
              {/* Outer glow effect */}
              <defs>
                <radialGradient id="radarGlow">
                  <stop offset="0%" stopColor="#00ff00" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#00ff00" stopOpacity="0" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Background glow */}
              <circle cx="100" cy="100" r="80" fill="url(#radarGlow)" className="animate-pulse" />
              
              {/* Radar circles with glow */}
              <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-40" filter="url(#glow)" />
              <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-50" filter="url(#glow)" />
              <circle cx="100" cy="100" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary opacity-60" filter="url(#glow)" />
              <circle cx="100" cy="100" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary opacity-80" filter="url(#glow)" />
              
              {/* Crosshairs with glow */}
              <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" strokeWidth="1" className="text-primary/40" filter="url(#glow)" />
              <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="1" className="text-primary/40" filter="url(#glow)" />
              
              {/* Diagonal lines */}
              <line x1="40" y1="40" x2="160" y2="160" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
              <line x1="160" y1="40" x2="40" y2="160" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
              
              {/* Rotating scanning beam with intense glow */}
              <g style={{ transformOrigin: '100px 100px', animation: 'radarSpin 2.5s linear infinite' }}>
                <path
                  d="M 100 100 L 100 30 A 70 70 0 0 1 155 55 Z"
                  fill="currentColor"
                  className="text-primary opacity-50"
                  filter="url(#glow)"
                />
                <line x1="100" y1="100" x2="100" y2="30" stroke="currentColor" strokeWidth="2" className="text-primary" filter="url(#glow)" />
              </g>
              
              {/* Center pulse */}
              <circle cx="100" cy="100" r="5" fill="currentColor" className="text-primary animate-ping" />
              <circle cx="100" cy="100" r="3" fill="currentColor" className="text-primary" />
              
              {/* Animated trader dots - MORE VISIBLE */}
              <g style={{ animation: 'blipPulse 2s ease-in-out infinite' }}>
                <circle cx="130" cy="70" r="3" fill="currentColor" className="text-primary" filter="url(#glow)" />
                <circle cx="130" cy="70" r="6" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-50" />
              </g>
              <g style={{ animation: 'blipPulse 2s ease-in-out infinite', animationDelay: '0.5s' }}>
                <circle cx="70" cy="80" r="3" fill="currentColor" className="text-primary" filter="url(#glow)" />
                <circle cx="70" cy="80" r="6" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-50" />
              </g>
              <g style={{ animation: 'blipPulse 2s ease-in-out infinite', animationDelay: '1s' }}>
                <circle cx="120" cy="130" r="3" fill="currentColor" className="text-primary" filter="url(#glow)" />
                <circle cx="120" cy="130" r="6" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-50" />
              </g>
              <g style={{ animation: 'blipPulse 2s ease-in-out infinite', animationDelay: '1.5s' }}>
                <circle cx="60" cy="120" r="3" fill="currentColor" className="text-primary" filter="url(#glow)" />
                <circle cx="60" cy="120" r="6" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-50" />
              </g>
            </svg>
          </div>

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="w-8 h-8 relative alien-glow">
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
                <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
                <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
                <circle cx="16" cy="16" r="2" fill="currentColor" className="text-primary animate-pulse" />
                <line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
                <line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
              </svg>
            </div>
            <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity alien-glow" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-primary relative z-10 alien-glow">TRADER_RADAR</h3>
          <p className="text-sm text-muted-foreground relative z-10">&gt; Geographic tracking</p>
        </Link>
        
        <style jsx>{`
          @keyframes radarSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes blipPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
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
            {loading ? '...' : `${Math.floor(stats.totalTraders / 100) * 100}+`}
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
            {loading ? '...' : stats.smartMarkets}
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
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground py-4">
                <div className="text-4xl alien-walk mb-2">👽</div>
                <div className="w-full max-w-[200px]">
                  <div className="bg-black pixel-border border-primary/50 p-0.5">
                    <div className="bg-black/80 h-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-green-400 to-primary animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs font-mono mt-2">&gt; LOADING...</p>
              </div>
            ) : topTraders.length > 0 ? (
              topTraders.slice(0, 4).map((trader) => (
                <Link
                  key={trader.address}
                  href={`/traders/${trader.address}`}
                  className="flex items-center gap-3 p-2.5 bg-black/40 pixel-border border-white/20 hover:border-[#FFD700] transition-all group"
                >
                  <img
                    src={trader.avatar}
                    alt={trader.displayName}
                    className="w-10 h-10 rounded-full bg-secondary object-cover pixel-border border-[#FFD700]"
                    onError={(e) => {
                      e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate text-sm">{trader.displayName}</p>
                    <p className="text-xs text-primary font-mono">
                      SCORE: {trader.rarityScore > 0 
                        ? trader.rarityScore >= 1000 
                          ? `${Math.round(trader.rarityScore / 1000)}k`
                          : Math.round(trader.rarityScore).toString()
                        : 'N/A'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-[#FFD700] text-black text-xs font-bold pixel-border">
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
          
          <div className="space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground py-4">
                <div className="text-4xl alien-walk mb-2">👽</div>
                <div className="w-full max-w-[200px]">
                  <div className="bg-black pixel-border border-purple-500/50 p-0.5">
                    <div className="bg-black/80 h-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-300 to-purple-500 animate-loading-bar"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs font-mono mt-2">&gt; LOADING...</p>
              </div>
            ) : topMarkets.length > 0 ? (
              topMarkets.map((market, idx) => (
                <Link
                  key={market.marketId}
                  href={`/markets/smart`}
                  className="block p-3 bg-black/40 pixel-border border-white/20 hover:border-purple-500 transition-all group"
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

      {/* Neural Network Site Map */}
      <SiteMapNeural />

      {/* Development Roadmap */}
      <div className="mt-8 mb-12 bg-card pixel-border border-primary/40 p-6">
        <div className="mb-4">
          <h3 className="font-bold text-primary text-xl mb-2 font-mono">🛸 DEVELOPMENT_ROADMAP</h3>
          <p className="text-xs text-muted-foreground font-mono mb-4">&gt; Tracking project evolution phases</p>
        </div>

        {/* Phases - Horizontal List */}
        <div className="space-y-2 mb-6">
          {/* Phase 1 - Completed */}
          <div className="text-sm font-mono">
            <span className="text-primary line-through">PHASE_1: Infrastructure & Core Setup</span>
            <span className="ml-2 text-xs">✅</span>
          </div>

          {/* Phase 2 - Completed */}
          <div className="text-sm font-mono">
            <span className="text-primary line-through">PHASE_2: Main Features Launch</span>
            <span className="ml-2 text-xs">✅</span>
            <span className="ml-2 text-xs text-muted-foreground line-through">(Trader tracking, Smart Markets, On-chain data)</span>
          </div>

          {/* Phase 3 - Current (Active) */}
          <div className="text-sm font-mono">
            <span className="text-purple-400 font-bold">PHASE_3: Global Trader Analytics</span>
            <span className="ml-2 text-purple-400 animate-pulse">...</span>
            <span className="ml-2 text-xs text-muted-foreground">(Deep analytics for every trader, comprehensive statistics)</span>
          </div>

          {/* Phase 4 - Future */}
          <div className="text-sm font-mono text-blue-400/70">
            <span>PHASE_4: AI Predictions & Alerts</span>
            <span className="ml-2 text-xs text-muted-foreground">(Planning: Pattern recognition, Auto-discovery)</span>
          </div>
        </div>
      </div>

      {/* Hot Markets Ticker */}
      <MarketTicker />
    </div>
  )
}
