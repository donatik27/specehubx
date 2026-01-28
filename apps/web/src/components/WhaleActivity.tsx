'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity } from 'lucide-react'
import Link from 'next/link'

interface WhaleTrade {
  id: string
  traderAddress: string
  traderName: string
  tier: string
  amount: number // in USDC
  outcome: 'YES' | 'NO'
  price: number // 0-1
  timestamp: number
  shares: number
  isNew?: boolean // For animation
}

interface WhaleActivityProps {
  marketId: string
}

export function WhaleActivity({ marketId }: WhaleActivityProps) {
  const [trades, setTrades] = useState<WhaleTrade[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // REAL WHALE ACTIVITY:
    // Fetch REAL trades from Polymarket via our authenticated API
    // Auto-refresh every 10 seconds for live feed
    
    const fetchTrades = async () => {
      try {
        // Use our API proxy with CLOB Client SDK
        const response = await fetch(
          `/api/market-trades?market=${marketId}&limit=100`,
          { cache: 'no-store' }
        )
        
        const data = await response.json()
        
        if (!response.ok) {
          console.error('Failed to fetch trades:', data.error || data.message)
          setTrades([])
          setLoading(false)
          return
        }
        
        // data is array of trades from CLOB API
        const tradesArray = Array.isArray(data) ? data : []
        
        // Filter for whale trades ($100+) and map to our format
        const allTrades: WhaleTrade[] = tradesArray
          .filter((trade: any) => {
            const amount = parseFloat(trade.size || '0') * parseFloat(trade.price || '0')
            return amount >= 100 // Min $100 for whale activity
          })
          .slice(0, 30) // Show top 30 recent trades
          .map((trade: any, idx: number) => {
            const maker = trade.maker || trade.maker_address || trade.taker_address || trade.taker
            const makerLabel = maker ? `${maker.slice(0, 6)}...${maker.slice(-4)}` : 'unknown'
            const amount = parseFloat(trade.size || '0') * parseFloat(trade.price || '0')
            
            return {
              id: `${trade.timestamp}-${idx}`,
              traderAddress: maker || 'unknown',
              traderName: makerLabel,
              tier: amount > 10000 ? 'S' : amount > 1000 ? 'A' : 'B',
              amount,
              outcome: trade.side === 'BUY' ? 'YES' : 'NO',
              price: parseFloat(trade.price || '0'),
              timestamp: new Date(trade.timestamp).getTime(),
              shares: parseFloat(trade.size || '0'),
              isNew: false
            }
          })
        
        // Mark new trades for animation
        setTrades((prevTrades) => {
          const prevIds = new Set(prevTrades.map(t => t.id))
          return allTrades.map(trade => ({
            ...trade,
            isNew: !prevIds.has(trade.id)
          }))
        })
        
        console.log(`🐋 Loaded ${allTrades.length} REAL trades`)
        
      } catch (error) {
        console.error('Error fetching trades:', error)
        setTrades([])
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchTrades()
    
    // Auto-refresh every 10 seconds for live updates
    const interval = setInterval(fetchTrades, 10000)
    
    return () => clearInterval(interval)
  }, [marketId])

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    if (seconds > 5) return `${seconds}s`
    return 'now'
  }

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`
    return `$${Math.floor(amount)}`
  }

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'S': return 'text-yellow-400'
      case 'A': return 'text-green-400'
      default: return 'text-blue-400'
    }
  }

  if (loading) {
    return (
      <div className="bg-black/60 pixel-border border-green-500/30 p-3">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-500/20">
          <Activity className="h-4 w-4 text-green-400 animate-pulse" />
          <h3 className="text-sm font-mono font-bold text-green-400">LIVE_TRADES</h3>
        </div>
        <div className="text-center text-green-400/50 text-xs font-mono py-8">
          &gt; Connecting to blockchain...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black/60 pixel-border border-purple-500/30 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-400 alien-glow" />
          <h3 className="text-sm font-bold text-purple-400">
            🐋 WHALE ACTIVITY
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-muted-foreground font-mono">
            Live
          </span>
        </div>
      </div>

      {/* Compact Trades List - Scrollable up to 30 */}
      <div 
        ref={scrollRef}
        className="space-y-2 max-h-[320px] overflow-y-auto pr-1 terminal-scroll"
      >
        {trades.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-6">
            <p className="font-mono">&gt; WAITING...</p>
          </div>
        ) : (
          trades.map((trade) => {
            const isYes = trade.outcome === 'YES'
            
            return (
              <Link
                key={trade.id}
                href={`/traders/${trade.traderAddress}`}
                className={`
                  block bg-black/40 pixel-border p-2
                  hover:border-purple-500/50 transition-all group
                  ${isYes ? 'border-green-500/30' : 'border-red-500/30'}
                  ${trade.isNew ? 'animate-fade-in-down' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className={`
                    w-8 h-8 pixel-border flex items-center justify-center flex-shrink-0
                    ${isYes ? 'bg-green-500/20' : 'bg-red-500/20'}
                  `}>
                    <span className={`text-sm font-bold ${getTierColor(trade.tier)}`}>
                      {trade.tier}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Name + Time */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                        {trade.traderName}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>
                    
                    {/* Amount + Badge + Price */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">
                        {formatAmount(trade.amount)}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <div className={`
                          px-2 py-0.5 text-[10px] font-bold pixel-border
                          ${isYes ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}
                        `}>
                          {trade.outcome}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          @{(trade.price * 100).toFixed(1)}¢
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-purple-500/20 text-[10px] text-muted-foreground font-mono text-center">
        {trades.length} trades • Min $100
      </div>
    </div>
  )
}
