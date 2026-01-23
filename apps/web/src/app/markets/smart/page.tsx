'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Brain, TrendingUp, RefreshCw, Users, DollarSign } from 'lucide-react'
import type { SmartMarketData } from '@/lib/smart-markets'

// Format balance for better readability
function formatBalance(balance: number): string {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(1)}M`
  } else if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1)}K`
  } else {
    return balance.toFixed(0)
  }
}

// Format volume/liquidity for display
function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`
  } else {
    return `$${amount.toFixed(0)}`
  }
}

// Check if this is a multi-outcome event
function isEvent(market: any): boolean {
  return Array.isArray(market.topTraders) && 
         market.topTraders.length > 0 &&
         market.topTraders[0].marketId !== undefined // Events have marketId in traders array
}

// Extract short name from outcome question
function extractShortName(question: string): string {
  // Remove common prefixes
  let name = question
    .replace(/^Will\s+/i, '')
    .replace(/^Who\s+will\s+/i, '')
    .replace(/\s+win.*$/i, '')
    .replace(/\s+be\s+.*$/i, '')
    .replace(/\s+become.*$/i, '')
    .trim()
  
  // If still too long, take first part
  if (name.length > 40) {
    name = name.split(/\s+/).slice(0, 4).join(' ')
  }
  
  return name
}

export default function SmartMarketsPage() {
  const [pinnedMarkets, setPinnedMarkets] = useState<SmartMarketData[]>([])
  const [dynamicMarkets, setDynamicMarkets] = useState<SmartMarketData[]>([])
  const [loadingPinned, setLoadingPinned] = useState(true)
  const [loadingDynamic, setLoadingDynamic] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchAllMarkets = async () => {
    try {
      setLoadingPinned(true)
      setLoadingDynamic(true)
      
      // For local dev without DB, fetch all markets at once (uses fallback)
      const response = await fetch('/api/smart-markets', {
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Separate pinned and dynamic (if any)
      const pinned = data.filter((m: any) => m.isPinned)
      const dynamic = data.filter((m: any) => !m.isPinned)
      
      setPinnedMarkets(pinned)
      setDynamicMarkets(dynamic)
      setLastUpdate(new Date().toISOString())
      
      console.log(`✅ Loaded ${data.length} markets (${pinned.length} pinned, ${dynamic.length} dynamic)`)
      
    } catch (error) {
      console.error('Failed to fetch smart markets:', error)
    } finally {
      setLoadingPinned(false)
      setLoadingDynamic(false)
    }
  }

  useEffect(() => {
    // Load all markets at once (fallback will handle it)
    fetchAllMarkets()
  }, [])

  const markets = [...pinnedMarkets, ...dynamicMarkets]
  const loading = loadingPinned && markets.length === 0

  // Animated loading messages
  const [loadingMessage, setLoadingMessage] = useState(0)
  const loadingMessages = [
    'Scanning blockchain for positions...',
    'Analyzing S/A tier traders...',
    'Computing smart scores...',
    'Finding alpha markets...'
  ]

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setLoadingMessage((prev) => (prev + 1) % loadingMessages.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [loading])

  // Inline alien loading (keeps sidebar visible)
  if (loading && markets.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="text-4xl">🧠</div>
            <h1 className="text-2xl font-bold text-primary alien-glow tracking-wider">ALPHA_MARKETS.AI</h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            &gt; ANALYZING WHERE S/A TIER TRADERS ARE POSITIONED...
          </p>
        </div>

        {/* Loading Content - EPIC ALIEN ANIMATION */}
        <div className="flex items-center justify-center min-h-[500px] relative overflow-hidden">
          {/* Flying UFOs in background */}
          <div className="absolute top-1/4 left-0 text-4xl opacity-30 animate-fly" style={{animationDelay: '0s'}}>
            🛸
          </div>
          <div className="absolute top-1/2 left-0 text-3xl opacity-20 animate-fly" style={{animationDelay: '3s'}}>
            🛸
          </div>
          <div className="absolute top-3/4 left-0 text-5xl opacity-25 animate-fly" style={{animationDelay: '6s'}}>
            🛸
          </div>
          
          {/* Scanning beam effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-scan"></div>
          </div>
          
          {/* Main alien with glow */}
          <div className="text-center relative z-10">
            {/* Rotating UFO above alien */}
            <div className="text-6xl mb-4 animate-spin-slow inline-block">🛸</div>
            
            {/* Main floating alien with glow */}
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-alien-glow"></div>
              <div className="text-9xl animate-float relative z-10">👽</div>
            </div>
            
            {/* Smaller floating aliens around */}
            <div className="absolute top-20 -left-10 text-4xl animate-float-slow" style={{animationDelay: '0.5s'}}>
              👾
            </div>
            <div className="absolute top-20 -right-10 text-4xl animate-float-slow" style={{animationDelay: '1s'}}>
              👾
            </div>
            
            <h2 className="text-2xl font-bold text-primary mb-4 alien-glow animate-pulse">
              SEARCHING FOR ALPHA...
            </h2>
            <p className="text-muted-foreground font-mono text-sm mb-4">
              &gt; {loadingMessages[loadingMessage]}
            </p>
            
            {/* Animated dots with glow */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center gap-1 text-primary text-3xl">
                <span className="animate-pulse inline-block" style={{animationDelay: '0ms'}}>●</span>
                <span className="animate-pulse inline-block" style={{animationDelay: '200ms'}}>●</span>
                <span className="animate-pulse inline-block" style={{animationDelay: '400ms'}}>●</span>
              </div>
            </div>
            
            {/* Progress indicator */}
            <div className="mt-6 w-64 h-1 bg-black border border-primary/30 mx-auto overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Cosmic Header */}
      <div className="mb-8 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-10 w-1 h-1 bg-primary animate-pulse"></div>
          <div className="absolute top-8 right-20 w-1 h-1 bg-white animate-pulse"></div>
          <div className="absolute top-4 right-40 w-1 h-1 bg-primary animate-pulse" style={{animationDelay: '0.5s'}}></div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-4xl">🧠</div>
              <h1 className="text-2xl font-bold text-primary alien-glow tracking-wider">ALPHA_MARKETS.AI</h1>
              {loading && <span className="text-primary animate-pulse">█</span>}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              &gt; ANALYZING WHERE S/A TIER TRADERS ARE POSITIONED...
            </p>
          </div>

          <button
            onClick={fetchAllMarkets}
            disabled={loading}
            className="px-6 py-3 bg-primary text-black font-bold pixel-border hover:bg-primary/80 transition-all disabled:opacity-50 flex items-center gap-3 text-sm uppercase tracking-wider"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'ANALYZING...' : 'REFRESH'}
          </button>
        </div>
        {lastUpdate && (
          <p className="text-xs text-primary font-mono mt-3 animate-pulse">
            &gt; LAST_ANALYSIS: {new Date(lastUpdate).toLocaleTimeString()} UTC
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🧠</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Smart_Markets</p>
          <p className="text-3xl font-bold text-white relative z-10">{markets.length}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">👥</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Avg_S/A_Count</p>
          <p className="text-3xl font-bold text-primary relative z-10">
            {markets.length > 0 ? (markets.reduce((a, b) => a + b.smartCount, 0) / markets.length).toFixed(1) : 0}
          </p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">💰</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Total_Volume</p>
          <p className="text-3xl font-bold text-white relative z-10">
            ${(markets.reduce((a, b) => a + b.volume, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">⚡</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Avg_Score</p>
          <p className="text-3xl font-bold text-primary relative z-10">
            {markets.length > 0 ? (markets.reduce((a, b) => a + b.smartScore, 0) / markets.length / 1000).toFixed(0) : 0}k
          </p>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="space-y-4">
        {/* PINNED MARKETS (TOP-5) */}
        {pinnedMarkets.map((market, idx) => (
          <Link 
            key={market.marketId}
            href={`/markets/smart/${market.marketId}`}
            className="block bg-card pixel-border border-primary/30 p-6 hover:border-primary transition-all group relative overflow-hidden"
          >
            {/* Rank badge */}
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 bg-primary text-black font-bold text-xs pixel-border">
                #{String(idx + 1).padStart(2, '0')}
              </span>
            </div>

            {/* Smart Score badge */}
            <div className="absolute top-3 right-3">
              <div className="text-right">
                <p className="text-xs font-mono text-primary mb-1">SMART_SCORE</p>
                <p className="text-2xl font-bold text-primary font-mono">{Math.round(market.smartScore).toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8">
              {/* Question */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl flex-shrink-0">{market.eventTitle && market.outcomeCount && market.outcomeCount > 2 ? '🏆' : '🎯'}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {market.eventTitle || market.question}
                  </h3>
                  {market.eventTitle && market.outcomeCount && market.outcomeCount > 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Multi-outcome • {market.outcomeCount} outcomes
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">S/A_TRADERS</p>
                  <p className="text-xl font-bold text-white">{market.smartCount}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">VOLUME</p>
                  <p className="text-xl font-bold text-primary">{formatMoney(market.volume)}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">LIQUIDITY</p>
                  <p className="text-xl font-bold text-white">{formatMoney(market.liquidity || 0)}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">CATEGORY</p>
                  <p className="text-sm font-bold text-white truncate">{market.category}</p>
                </div>
              </div>

              {/* EVENT OUTCOMES or TRADER LIST */}
              {market.topTraders && market.topTraders.length > 0 && (
                <>
                  {isEvent(market) ? (
                    // EVENT VIEW: Show top outcomes with trader counts
                    <div className="bg-black/40 pixel-border border-[#FFD700]/30 p-4">
                      <p className="text-xs font-mono text-[#FFD700] mb-3 uppercase tracking-wider">
                        🏆 TOP_OUTCOMES ({market.topTraders.length} total):
                      </p>
                      <div className="space-y-2">
                        {market.topTraders.slice(0, 5).map((outcome: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-black/60 pixel-border border-white/10 p-3">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-white">
                                {extractShortName(outcome.question)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(outcome.price * 100).toFixed(1)}% • {outcome.traders?.length || 0} traders
                              </p>
                            </div>
                            <div className="flex -space-x-1">
                              {outcome.traders?.slice(0, 3).map((t: any, i: number) => (
                                <div 
                                  key={i}
                                  className={`w-6 h-6 rounded-full pixel-border flex items-center justify-center text-xs font-bold ${
                                    t.tier === 'S' ? 'bg-[#FFD700] text-black border-[#FFD700]' : 
                                    t.tier === 'A' ? 'bg-white text-black border-white' :
                                    'bg-primary text-black border-primary'
                                  }`}
                                >
                                  {t.tier}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* SINGLE MARKET VIEW: Show tier composition */}
                      <div className="bg-black/40 pixel-border border-primary/30 p-4 mb-3">
                        <p className="text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                          📊 TIER_COMPOSITION (S=5pts, A=3pts, B=2pts):
                        </p>
                        <div className="flex gap-4">
                          {['S', 'A', 'B'].map(tier => {
                            const count = market.topTraders.filter((t: any) => t.tier === tier).length
                            const points = count * (tier === 'S' ? 5 : tier === 'A' ? 3 : 2)
                            if (count === 0) return null
                            return (
                              <div key={tier} className="flex items-center gap-2">
                                <span className={`px-2 py-1 text-sm font-bold pixel-border ${
                                  tier === 'S' ? 'bg-[#FFD700] text-black' :
                                  tier === 'A' ? 'bg-white text-black' :
                                  'bg-primary text-black'
                                }`}>
                                  {tier}
                                </span>
                                <span className="text-white font-mono">
                                  x{count} = <span className="text-primary">{points}pts</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* All Smart Traders */}
                      <div className="bg-black/40 pixel-border border-primary/30 p-4">
                        <p className="text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                          👽 ALL_SMART_TRADERS ({market.topTraders.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {market.topTraders.map((trader: any) => (
                            <div 
                          key={trader.address}
                          className="flex items-center gap-2 bg-black pixel-border border-white/30 p-2 hover:border-primary transition-all"
                        >
                          <span className={`px-2 py-0.5 text-xs font-bold pixel-border ${
                            trader.tier === 'S' ? 'bg-[#FFD700] text-black border-[#FFD700]' :
                            trader.tier === 'A' ? 'bg-white text-black border-white' :
                            trader.tier === 'B' ? 'bg-primary text-black border-primary' :
                            'bg-gray-400 text-black border-gray-400'
                          }`}>
                            {trader.tier}
                          </span>
                          <span className="text-sm font-mono text-white">
                            {trader.displayName.length > 12 
                              ? `${trader.displayName.slice(0, 8)}...` 
                              : trader.displayName
                            }
                          </span>
                          <span className="text-xs font-mono text-primary">
                            {Math.round(trader.rarityScore / 1000)}k
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                    </>
                  )}
                </>
              )}
            </div>
          </Link>
        ))}

        {/* SEARCHING FOR MORE ALPHA (loading dynamic) */}
        {loadingDynamic && pinnedMarkets.length > 0 && (
          <div className="bg-card pixel-border border-primary/30 p-12 text-center">
            <div className="text-6xl mb-4 animate-bounce inline-block">👽</div>
            <h3 className="text-xl font-bold text-primary mb-2 alien-glow">
              SEARCHING FOR MORE ALPHA...
            </h3>
            <p className="text-muted-foreground font-mono text-sm mb-2">
              &gt; Discovering new smart markets...
            </p>
            <div className="flex items-center justify-center gap-1 text-primary text-xl">
              <span className="animate-pulse" style={{animationDelay: '0ms'}}>.</span>
              <span className="animate-pulse" style={{animationDelay: '200ms'}}>.</span>
              <span className="animate-pulse" style={{animationDelay: '400ms'}}>.</span>
            </div>
          </div>
        )}

        {/* DYNAMIC MARKETS (newly discovered) */}
        {dynamicMarkets.map((market, idx) => (
          <Link 
            key={market.marketId}
            href={`/markets/smart/${market.marketId}`}
            className="block bg-card pixel-border border-primary/30 p-6 hover:border-primary transition-all group relative overflow-hidden"
          >
            {/* Rank badge */}
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 bg-primary text-black font-bold text-xs pixel-border">
                #{String(pinnedMarkets.length + idx + 1).padStart(2, '0')}
              </span>
            </div>

            {/* Smart Score badge */}
            <div className="absolute top-3 right-3">
              <div className="text-right">
                <p className="text-xs font-mono text-primary mb-1">SMART_SCORE</p>
                <p className="text-2xl font-bold text-primary font-mono">{Math.round(market.smartScore).toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8">
              {/* Question */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl flex-shrink-0">{market.eventTitle && market.outcomeCount && market.outcomeCount > 2 ? '🏆' : '🎯'}</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {market.eventTitle || market.question}
                  </h3>
                  {market.eventTitle && market.outcomeCount && market.outcomeCount > 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Multi-outcome • {market.outcomeCount} outcomes
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">S/A_TRADERS</p>
                  <p className="text-xl font-bold text-white">{market.smartCount}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">VOLUME</p>
                  <p className="text-xl font-bold text-primary">{formatMoney(market.volume)}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">LIQUIDITY</p>
                  <p className="text-xl font-bold text-white">{formatMoney(market.liquidity || 0)}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">CATEGORY</p>
                  <p className="text-sm font-bold text-white truncate">{market.category}</p>
                </div>
              </div>

              {/* Tier Breakdown & Smart Traders */}
              {market.topTraders && market.topTraders.length > 0 && (
                <>
                  {/* Tier composition stats */}
                  <div className="bg-black/40 pixel-border border-primary/30 p-4 mb-3">
                    <p className="text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                      📊 TIER_COMPOSITION (S=5pts, A=3pts, B=2pts, C=1pt):
                    </p>
                    <div className="flex gap-4">
                      {['S', 'A', 'B', 'C'].map(tier => {
                        const count = market.topTraders.filter((t: any) => t.tier === tier).length
                        const points = count * (tier === 'S' ? 5 : tier === 'A' ? 3 : tier === 'B' ? 2 : 1)
                        if (count === 0) return null
                        return (
                          <div key={tier} className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-sm font-bold pixel-border ${
                              tier === 'S' ? 'bg-[#FFD700] text-black' :
                              tier === 'A' ? 'bg-white text-black' :
                              tier === 'B' ? 'bg-primary text-black' :
                              'bg-gray-400 text-black'
                            }`}>
                              {tier}
                            </span>
                            <span className="text-white font-mono">
                              ×{count} = {points}pts
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Top smart traders grid */}
                  <div className="bg-black/40 pixel-border border-primary/30 p-4">
                    <p className="text-xs font-mono text-primary mb-3 uppercase tracking-wider">
                      🧠 TOP_SMART_TRADERS in this market:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {market.topTraders.map((trader: any) => (
                        <div 
                          key={trader.address}
                          className="flex items-center gap-2 bg-black pixel-border border-white/30 p-2 hover:border-primary transition-all"
                        >
                          <span className={`px-2 py-0.5 text-xs font-bold pixel-border ${
                            trader.tier === 'S' ? 'bg-[#FFD700] text-black border-[#FFD700]' :
                            trader.tier === 'A' ? 'bg-white text-black border-white' :
                            trader.tier === 'B' ? 'bg-primary text-black border-primary' :
                            'bg-gray-400 text-black border-gray-400'
                          }`}>
                            {trader.tier}
                          </span>
                          <span className="text-sm font-mono text-white">
                            {trader.displayName.length > 12 
                              ? `${trader.displayName.slice(0, 8)}...` 
                              : trader.displayName
                            }
                          </span>
                          <span className="text-xs font-mono text-primary">
                            ({formatBalance(trader.balance || 0)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-20">
          <div className="inline-block">
            <RefreshCw className="h-12 w-12 text-primary animate-spin" />
            <p className="text-primary font-mono mt-4 animate-pulse">ANALYZING_SMART_MONEY...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && markets.length === 0 && (
        <div className="text-center py-20 bg-card pixel-border border-primary/30 p-12">
          <div className="text-6xl mb-4">🛸</div>
          <p className="text-xl font-bold text-primary mb-2">NO_SMART_MARKETS_DETECTED</p>
          <p className="text-muted-foreground font-mono">Try refreshing or check back later</p>
        </div>
      )}
    </div>
  )
}

