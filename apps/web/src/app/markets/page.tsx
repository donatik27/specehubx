'use client'

import { useState, useEffect } from 'react'
import { Store, TrendingUp, Calendar, RefreshCw, DollarSign } from 'lucide-react'

interface Market {
  id: string
  question: string
  category: string
  volume: number
  liquidity: number
  endDate: string
  active: boolean
  closed: boolean
  outcomes: string
  outcomePrices: string
  slug?: string
  eventSlug?: string
  eventTitle?: string // Event title for multi-outcome markets
  marketCount?: number // Number of markets in this event
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const marketsPerPage = 20

  const fetchMarkets = async () => {
    try {
      setLoading(true)
      
      // Fetch TOP 100 markets by volume from Polymarket
      const response = await fetch('/api/markets?limit=100', {
        cache: 'no-cache'
      })
      
      if (!response.ok) {
        console.error('API Response:', response.status, response.statusText)
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      // Group by eventSlug to avoid duplicates
      // For multi-outcome events, show event title once with combined volume
      const eventMap = new Map<string, any>()
      
      for (const market of data) {
        const key = market.eventSlug || market.id // Use eventSlug as key, fallback to marketId
        
        if (eventMap.has(key)) {
          // Aggregate volume for same event
          const existing = eventMap.get(key)
          existing.volume += market.volume
          existing.marketCount = (existing.marketCount || 1) + 1
        } else {
          eventMap.set(key, { ...market, marketCount: 1 })
        }
      }
      
      // Convert back to array and sort by volume
      const deduplicated = Array.from(eventMap.values()).sort((a, b) => b.volume - a.volume)

      setMarkets(deduplicated)
      setLastUpdate(new Date().toISOString())
      
      console.log(`✅ Loaded ${data.length} markets → ${deduplicated.length} unique events`)
      
    } catch (error) {
      console.error('Failed to fetch markets:', error)
      alert('Failed to load markets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMarkets()
  }, [])

  // Pagination
  const totalPages = Math.ceil(markets.length / marketsPerPage)
  const startIndex = (currentPage - 1) * marketsPerPage
  const endIndex = startIndex + marketsPerPage
  const currentMarkets = markets.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
              <div className="text-4xl">🔥</div>
              <h1 className="text-2xl font-bold text-primary alien-glow tracking-wider">HOT_MARKETS</h1>
              {loading && <span className="text-primary animate-pulse">█</span>}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              &gt; ANALYZING TOP_{markets.length} PREDICTION_MARKETS...
            </p>
          </div>

          <button
            onClick={fetchMarkets}
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

      {/* Stats - Alien Data Pods */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🎲</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Total_Markets</p>
          <p className="text-3xl font-bold text-white relative z-10">{markets.length}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">💰</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Total_Volume</p>
          <p className="text-3xl font-bold text-primary relative z-10">
            ${(markets.reduce((a, b) => a + b.volume, 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">📊</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Current_Page</p>
          <p className="text-3xl font-bold text-white relative z-10">{currentPage} / {totalPages}</p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden group hover:border-primary transition-all">
          <div className="absolute top-0 right-0 text-4xl opacity-10">💎</div>
          <p className="text-xs font-mono text-primary mb-2 uppercase tracking-wider">Avg_Liquidity</p>
          <p className="text-3xl font-bold text-white relative z-10">
            ${(markets.reduce((a, b) => a + b.liquidity, 0) / markets.length / 1000).toFixed(0)}k
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
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider w-16">Rank</th>
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider">Question</th>
                <th className="text-left p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">Category</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">Volume</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">Liquidity</th>
                <th className="text-right p-3 text-xs font-bold text-primary uppercase tracking-wider w-32">End_Date</th>
              </tr>
            </thead>
            <tbody>
              {currentMarkets.map((market: any, idx) => {
                // Generate Polymarket URL (prefer eventSlug, fallback to market slug) + referral
                const polymarketUrl = market.eventSlug
                  ? `https://polymarket.com/event/${market.eventSlug}?via=01k`
                  : market.slug
                    ? `https://polymarket.com/market/${market.slug}?via=01k`
                    : `https://polymarket.com?via=01k` // Ultimate fallback
                
                return (
                  <tr 
                    key={market.id}
                    onClick={() => window.open(polymarketUrl, '_blank')}
                    className="border-t border-white/10 hover:bg-primary/5 hover:border-primary/50 transition-all group cursor-pointer"
                  >
                  <td className="p-3 text-primary font-bold font-mono text-sm group-hover:text-white transition-colors">
                    #{String(startIndex + idx + 1).padStart(3, '0')}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl flex-shrink-0">{market.eventSlug && market.marketCount && market.marketCount > 1 ? '🏆' : '🎯'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-white group-hover:text-primary transition-colors truncate">
                          {market.eventTitle || market.question}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {market.eventSlug && market.marketCount && market.marketCount > 1 ? (
                            `Multi-outcome event • ${market.marketCount} outcomes`
                          ) : (
                            `ID: ${market.id}`
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-mono pixel-border border-primary/50">
                      {market.category}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-primary text-sm">💵</span>
                      <span className="font-bold font-mono text-base text-primary">
                        ${(market.volume / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      ${(market.liquidity / 1000).toFixed(0)}k
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono text-xs text-white">
                      {formatDate(market.endDate)}
                    </span>
                  </td>
                </tr>
                )
              })}
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
