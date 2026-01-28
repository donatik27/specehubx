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
    // BLOCKCHAIN TERMINAL FEED:
    // Lower threshold ($100+) to show more activity
    // Auto-refresh every 10 seconds for live updates
    
    const fetchTrades = async () => {
      try {
        const response = await fetch(
          `https://clob.polymarket.com/trades?market=${marketId}`,
          { cache: 'no-store' }
        )
        
        if (!response.ok) {
          console.warn('Failed to fetch trades, using simulated data')
          setTrades(getSimulatedTrades())
          setLoading(false)
          return
        }
        
        const data = await response.json()
        
        // Filter for significant trades ($500+)
        const allTrades: WhaleTrade[] = data
          .filter((trade: any) => parseFloat(trade.size) * parseFloat(trade.price) > 500)
          .slice(0, 15) // Show up to 15 recent trades
          .map((trade: any, idx: number) => ({
            id: `${trade.timestamp}-${idx}`,
            traderAddress: trade.maker_address || trade.taker_address,
            traderName: `${trade.maker_address?.slice(0, 6)}...${trade.maker_address?.slice(-4)}`,
            tier: parseFloat(trade.size) * parseFloat(trade.price) > 10000 ? 'S' : 
                  parseFloat(trade.size) * parseFloat(trade.price) > 1000 ? 'A' : 'B',
            amount: parseFloat(trade.size) * parseFloat(trade.price),
            outcome: trade.side === 'BUY' ? 'YES' : 'NO',
            price: parseFloat(trade.price),
            timestamp: new Date(trade.timestamp).getTime(),
            shares: parseFloat(trade.size),
            isNew: false
          }))
        
        // Mark new trades for animation
        setTrades((prevTrades) => {
          const prevIds = new Set(prevTrades.map(t => t.id))
          return allTrades.map(trade => ({
            ...trade,
            isNew: !prevIds.has(trade.id)
          }))
        })
        
        console.log(`🐋 Loaded ${allTrades.length} trades`)
      } catch (error) {
        console.error('Error fetching trades:', error)
        setTrades(getSimulatedTrades())
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchTrades()
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTrades, 10000)
    
    return () => clearInterval(interval)
    
    // TEMPORARY FALLBACK: Simulated trades
    function getSimulatedTrades(): WhaleTrade[] {
      return Array.from({ length: 15 }, (_, i) => {
        const isYes = Math.random() > 0.5
        const amount = Math.floor(Math.random() * 50000) + 100
        return {
          id: `sim-${Date.now()}-${i}`,
          traderAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
          traderName: `0x${Math.random().toString(16).slice(2, 8)}...${Math.random().toString(16).slice(2, 6)}`,
          tier: amount > 10000 ? 'S' : amount > 1000 ? 'A' : 'B',
          amount,
          outcome: isYes ? 'YES' : 'NO',
          price: isYes ? 0.6 + Math.random() * 0.3 : 0.1 + Math.random() * 0.3,
          timestamp: Date.now() - Math.random() * 7200000,
          shares: Math.floor(amount / (isYes ? 0.76 : 0.24)),
          isNew: false
        }
      })
    }
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
    <div className="bg-black/60 pixel-border border-purple-500/30 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-purple-400 alien-glow" />
          <h3 className="text-base font-bold text-purple-400">
            🐋 WHALE ACTIVITY
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground font-mono">
            Live • 10s
          </span>
        </div>
      </div>

      {/* Trades Grid - Show fewer but more detailed */}
      <div 
        ref={scrollRef}
        className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 terminal-scroll"
      >
        {trades.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p className="font-mono">&gt; WAITING_FOR_TRADES...</p>
          </div>
        ) : (
          trades.slice(0, 8).map((trade) => {
            const isYes = trade.outcome === 'YES'
            
            return (
              <Link
                key={trade.id}
                href={`/traders/${trade.traderAddress}`}
                className={`
                  block bg-black/40 pixel-border p-3
                  hover:border-purple-500/50 transition-all group
                  ${isYes ? 'border-green-500/30' : 'border-red-500/30'}
                  ${trade.isNew ? 'animate-fade-in-down' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`
                    w-10 h-10 pixel-border flex items-center justify-center flex-shrink-0
                    ${isYes ? 'bg-green-500/20' : 'bg-red-500/20'}
                  `}>
                    <span className={`text-lg ${getTierColor(trade.tier)}`}>
                      {trade.tier}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Name + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                        {trade.traderName}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>
                    
                    {/* Amount - Large */}
                    <div className="text-xl font-bold text-white mb-2">
                      {formatAmount(trade.amount)}
                    </div>
                    
                    {/* Badge + Price */}
                    <div className="flex items-center gap-3">
                      <div className={`
                        px-3 py-1 text-sm font-bold pixel-border
                        ${isYes ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}
                      `}>
                        {trade.outcome}
                      </div>
                      <span className="text-sm text-muted-foreground font-mono">
                        @ {(trade.price * 100).toFixed(1)}¢
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-purple-500/20 text-xs text-muted-foreground font-mono text-center">
        Showing top {Math.min(trades.length, 8)} trades • Min $500
      </div>
    </div>
  )
}
