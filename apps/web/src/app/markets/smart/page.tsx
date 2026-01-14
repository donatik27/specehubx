'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Brain, TrendingUp, RefreshCw, Users, DollarSign } from 'lucide-react'
import type { SmartMarketData } from '@/lib/smart-markets'

export default function SmartMarketsPage() {
  const [markets, setMarkets] = useState<SmartMarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchSmartMarkets = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/smart-markets', {
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      setMarkets(data)
      setLastUpdate(new Date().toISOString())
      
      console.log(`✅ Loaded ${data.length} smart markets`)
      
    } catch (error) {
      console.error('Failed to fetch smart markets:', error)
      alert('Failed to load smart markets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSmartMarkets()
  }, [])

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
            onClick={fetchSmartMarkets}
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
        {markets.map((market, idx) => (
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
                <span className="text-3xl flex-shrink-0">🎯</span>
                <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                  {market.question}
                </h3>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">S/A_TRADERS</p>
                  <p className="text-xl font-bold text-white">{market.smartCount}</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">VOLUME</p>
                  <p className="text-xl font-bold text-primary">${(market.volume / 1000).toFixed(0)}k</p>
                </div>
                <div className="bg-black/40 pixel-border border-white/20 p-3">
                  <p className="text-xs font-mono text-primary mb-1">LIQUIDITY</p>
                  <p className="text-xl font-bold text-white">${(market.liquidity / 1000).toFixed(0)}k</p>
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
                      👽 ALL_SMART_TRADERS_IN_MARKET ({market.topTraders.length}):
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

