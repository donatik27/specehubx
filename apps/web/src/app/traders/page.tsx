'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, TrendingDown, ArrowUpDown, RefreshCw, Calendar } from 'lucide-react'
import type { TimeInterval } from '@/lib/polymarket-api'

interface Trader {
  address: string;
  displayName: string;
  avatar: string;
  tier: string;
  rarityScore: number;
  estimatedPnL: number;
  winRate: number;
  tradeCount: number;
  volume: number;
  rank?: number;
  verified?: boolean;
  xUsername?: string | null;
  onRadar?: boolean;
}

const tierColors: Record<string, string> = {
  S: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/50',
  A: 'bg-white/20 text-white border-white/50',
  B: 'bg-primary/20 text-primary border-primary/50',
  X: 'bg-purple-500/20 text-purple-400 border-purple-500/30', // For public traders filter
}

export default function TradersPage() {
  const [sortBy, setSortBy] = useState<'pnl' | 'winRate' | 'trades'>('pnl')
  const [filterTier, setFilterTier] = useState<string>('all')
  const [timeframe, setTimeframe] = useState<TimeInterval>('1mo')
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [totalTraders, setTotalTraders] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const tradersPerPage = 50

  const fetchTraders = async () => {
    try {
      setLoading(true)
      
      // Fetch from API route (server-side proxy to Polymarket)
      const response = await fetch('/api/traders')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const tradersData = await response.json()
      
      setTraders(tradersData)
      setTotalTraders(tradersData.length)
      setLastUpdate(new Date().toISOString())
      
      console.log(`✅ Loaded ${tradersData.length} traders (Monthly)`)
      
    } catch (error) {
      console.error('Failed to fetch traders:', error)
      alert('Loading error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTraders()
  }, [])

  const filteredTraders = (traders || [])
    .filter(t => {
      if (filterTier === 'all') return true
      if (filterTier === 'X') return !!t.xUsername // Show only public traders with Twitter
      return t.tier === filterTier
    })
    .sort((a, b) => {
      if (sortBy === 'pnl') return b.estimatedPnL - a.estimatedPnL
      if (sortBy === 'winRate') return b.winRate - a.winRate
      return b.tradeCount - a.tradeCount
    })

  // Pagination
  const totalPages = Math.ceil(filteredTraders.length / tradersPerPage)
  const startIndex = (currentPage - 1) * tradersPerPage
  const endIndex = startIndex + tradersPerPage
  const currentTraders = filteredTraders.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Cosmic Header */}
      <div className="mb-8 relative">
        {/* Alien stars background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-10 w-1 h-1 bg-primary animate-pulse"></div>
          <div className="absolute top-8 right-20 w-1 h-1 bg-white animate-pulse"></div>
          <div className="absolute top-4 right-40 w-1 h-1 bg-primary animate-pulse" style={{animationDelay: '0.5s'}}></div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="relative">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-4xl">👽</div>
              <h1 className="text-2xl font-bold text-primary alien-glow tracking-wider">TRADER_INTEL</h1>
              {loading && <span className="text-primary animate-pulse">█</span>}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              &gt; SCANNING POLYMARKET NETWORK... {traders.length} ENTITIES DETECTED
            </p>
          </div>
          <button
            onClick={fetchTraders}
            disabled={loading}
            className="px-6 py-3 bg-primary text-black font-bold pixel-border hover:bg-primary/80 transition-all disabled:opacity-50 flex items-center gap-3 text-sm uppercase tracking-wider"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'SCANNING...' : 'REFRESH'}
          </button>
        </div>
        {lastUpdate && (
          <p className="text-xs text-primary font-mono mt-3 animate-pulse">
            &gt; LAST_SCAN: {new Date(lastUpdate).toLocaleTimeString()} UTC
          </p>
        )}
      </div>

      {/* Period Badge - Pixel Style */}
      <div className="bg-card pixel-border border-primary/30 p-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-xl"></div>
        <div className="flex items-center gap-3 relative z-10">
          <span className="text-primary text-xl">📅</span>
          <span className="text-sm font-mono text-muted-foreground">TIME_PERIOD:</span>
          <span className="px-4 py-1 bg-primary text-black font-bold text-sm uppercase tracking-wider pixel-border">
            MONTHLY
          </span>
          <span className="text-primary animate-pulse ml-auto">◆</span>
        </div>
      </div>

      {/* Filters - Alien Command Center */}
      <div className="bg-card pixel-border border-white/20 p-5 mb-6 flex flex-wrap gap-4 items-center relative">
        <div className="absolute top-2 right-2 text-primary text-xs font-mono animate-pulse">FILTERS.SYS</div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary">TIER_FILTER:</span>
          <div className="flex gap-2">
            {['all', 'S', 'A', 'B', 'X'].map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-3 py-1 text-sm font-bold uppercase transition-all pixel-border ${
                  filterTier === tier
                    ? 'bg-primary text-black border-primary'
                    : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
                }`}
              >
                {tier === 'all' ? 'ALL' : tier}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-primary/30" />

        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary">SORT_BY:</span>
          <button
            onClick={() => setSortBy('pnl')}
            className={`px-3 py-1 text-sm flex items-center gap-2 font-bold uppercase pixel-border transition-all ${
              sortBy === 'pnl' ? 'bg-primary text-black border-primary' : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
            }`}
          >
            PNL <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => setSortBy('winRate')}
            className={`px-3 py-1 text-sm flex items-center gap-2 font-bold uppercase pixel-border transition-all ${
              sortBy === 'winRate' ? 'bg-primary text-black border-primary' : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
            }`}
          >
            WIN_RATE <ArrowUpDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Stats - Alien Data Pods */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🛸</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Total_Entities</p>
          <p className="text-3xl font-bold text-white relative z-10">{totalTraders}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">📡</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Current_Sector</p>
          <p className="text-3xl font-bold text-white relative z-10">{currentPage} / {totalPages}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">👾</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Displaying</p>
          <p className="text-3xl font-bold text-white relative z-10">{startIndex + 1}-{Math.min(endIndex, filteredTraders.length)}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">⚡</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Avg_Success</p>
          <p className="text-3xl font-bold text-primary relative z-10">
            {filteredTraders.length > 0 ? (filteredTraders.reduce((a, b) => a + b.winRate, 0) / filteredTraders.length * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Table - Alien Database */}
      <div className="bg-card pixel-border border-primary/30 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-black/60 border-b-2 border-primary/50">
              <tr className="font-mono">
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider w-20">Rank</th>
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider w-48">Entity_ID</th>
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider w-20">Tier</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-24">Score</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">Credits</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">Volume</th>
                <th className="text-center p-3 text-xs font-bold text-primary uppercase tracking-wider w-24">Radar</th>
              </tr>
            </thead>
            <tbody>
              {currentTraders.map((trader, idx) => (
                <tr 
                  key={trader.address}
                  onClick={() => window.location.href = `/traders/${trader.address}`}
                  className="border-t border-white/10 hover:bg-primary/5 hover:border-primary/50 transition-all group cursor-pointer"
                >
                  <td className="p-3 text-primary font-bold font-mono text-sm group-hover:text-white transition-colors">
                    #{String(startIndex + idx + 1).padStart(3, '0')}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <img 
                          src={trader.avatar} 
                          alt={trader.displayName}
                          className="w-10 h-10 border-2 border-primary/50 bg-black object-cover group-hover:border-primary transition-all"
                          style={{imageRendering: 'pixelated'}}
                          onError={(e) => {
                            e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
                          }}
                        />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary border border-black"></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
                            {trader.displayName.length > 18 
                              ? `${trader.displayName.slice(0, 8)}...${trader.displayName.slice(-6)}`
                              : trader.displayName
                            }
                          </p>
                          {trader.verified && (
                            <span className="text-primary text-xs flex-shrink-0" title="Verified">✓</span>
                          )}
                          {trader.xUsername && trader.xUsername.trim() !== '' && (
                            <span className="text-primary text-xs pixel-border px-1 flex-shrink-0" title={`Twitter: @${trader.xUsername}`}>
                              X
                            </span>
                          )}
                        </div>
                        {trader.xUsername && trader.xUsername.trim() !== '' ? (
                          <p className="text-xs text-primary font-mono truncate">
                            @{trader.xUsername.length > 14 ? `${trader.xUsername.slice(0, 12)}..` : trader.xUsername}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono">
                            {trader.address.slice(0, 6)}...{trader.address.slice(-4)}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold pixel-border ${
                        trader.tier === 'S' ? 'bg-[#FFD700] text-black border-[#FFD700] gold-glow' :
                        trader.tier === 'A' ? 'bg-white text-black border-white' :
                        trader.tier === 'B' ? 'bg-transparent text-primary border-primary' :
                        'bg-transparent text-white border-white/50'
                      }`}>
                        {trader.tier}
                      </span>
                      {trader.tier === 'S' && trader.xUsername && trader.xUsername.trim() !== '' && (
                        <span className="text-[#FFD700] text-xs animate-pulse" title="Public Influencer">👽</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-sm font-bold text-primary group-hover:text-white transition-colors">
                      {trader.rarityScore.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-base">
                        {trader.estimatedPnL >= 0 ? '▲' : '▼'}
                      </span>
                      <span className={`font-bold font-mono text-base ${trader.estimatedPnL >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {(() => {
                          const abs = Math.abs(trader.estimatedPnL);
                          if (abs >= 1_000_000) {
                            return `$${(abs / 1_000_000).toFixed(1)}M`;
                          }
                          return `$${(abs / 1000).toFixed(0)}K`;
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      {(() => {
                        const vol = trader.volume;
                        if (vol >= 1_000_000) {
                          return `$${(vol / 1_000_000).toFixed(1)}M`;
                        }
                        return `$${(vol / 1000).toFixed(0)}K`;
                      })()}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center">
                      {trader.onRadar ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = '/map';
                          }}
                          className="flex items-center gap-1 px-2 py-1 pixel-border border-primary bg-primary/10 hover:bg-primary/20 transition-all group/radar"
                          title="On Trader Radar - Click to view map"
                        >
                          <span className="text-primary text-sm">📡</span>
                          <span className="text-primary text-xs font-bold">✓</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination - Alien Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 p-4 bg-card pixel-border border-primary/30">
          <div className="text-sm font-mono text-primary flex items-center gap-2">
            <span className="animate-pulse">◆</span>
            SECTOR_{currentPage} / {totalPages}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="px-4 py-2 pixel-border border-white/30 hover:border-primary hover:text-primary bg-transparent disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              ««
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 pixel-border border-white/30 hover:border-primary hover:text-primary bg-transparent disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold uppercase transition-all"
            >
              ← PREV
            </button>
            
            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-4 py-2 pixel-border text-sm font-bold font-mono transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary text-black border-primary'
                        : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {String(pageNum).padStart(2, '0')}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 pixel-border border-white/30 hover:border-primary hover:text-primary bg-transparent disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold uppercase transition-all"
            >
              NEXT →
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 pixel-border border-white/30 hover:border-primary hover:text-primary bg-transparent disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

