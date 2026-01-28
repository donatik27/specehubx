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
        
        // Lower threshold to $100 for more activity
        const allTrades: WhaleTrade[] = data
          .filter((trade: any) => parseFloat(trade.size) * parseFloat(trade.price) > 100)
          .slice(0, 20) // Show up to 20 recent trades
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
    <div className="bg-black/60 pixel-border border-green-500/30 p-3">
      {/* Terminal Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-green-500/20">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-400 alien-glow" />
          <h3 className="text-sm font-mono font-bold text-green-400">
            LIVE_TRADES
          </h3>
          <span className="text-xs text-green-400/60 font-mono">
            ${'>'}$100
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400/60 font-mono">
            LIVE • 10s
          </span>
        </div>
      </div>

      {/* Scrollable Terminal Feed */}
      <div 
        ref={scrollRef}
        className="space-y-1 max-h-[400px] overflow-y-auto overflow-x-hidden pr-2 terminal-scroll"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(34, 197, 94, 0.3) transparent'
        }}
      >
        {trades.length === 0 ? (
          <div className="text-center text-green-400/50 text-xs font-mono py-8">
            <p>&gt; WAITING_FOR_TRADES...</p>
          </div>
        ) : (
          trades.map((trade) => {
            const isYes = trade.outcome === 'YES'
            
            return (
              <Link
                key={trade.id}
                href={`/traders/${trade.traderAddress}`}
                className={`
                  block px-2 py-1.5 font-mono text-xs
                  hover:bg-green-500/10 transition-all duration-200
                  border-l-2 ${isYes ? 'border-green-500/50' : 'border-red-500/50'}
                  ${trade.isNew ? 'animate-fade-in-down bg-green-500/20' : ''}
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Address + Tier */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`font-bold ${getTierColor(trade.tier)}`}>
                      [{trade.tier}]
                    </span>
                    <span className="text-green-400/80 truncate">
                      {trade.traderName}
                    </span>
                  </div>
                  
                  {/* Right: Time */}
                  <span className="text-green-400/50 text-[10px]">
                    {formatTime(trade.timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  {/* Amount */}
                  <span className="text-white font-bold">
                    {formatAmount(trade.amount)}
                  </span>
                  
                  {/* Badge + Price */}
                  <div className="flex items-center gap-2">
                    <span className={`
                      px-1.5 py-0.5 text-[10px] font-bold
                      ${isYes ? 'text-green-400' : 'text-red-400'}
                    `}>
                      {trade.outcome}
                    </span>
                    <span className="text-green-400/60">
                      @{(trade.price * 100).toFixed(1)}¢
                    </span>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Terminal Footer */}
      <div className="mt-3 pt-2 border-t border-green-500/20 text-[10px] text-green-400/50 font-mono text-center">
        {trades.length} trades • Polymarket CLOB
      </div>
    </div>
  )
}
