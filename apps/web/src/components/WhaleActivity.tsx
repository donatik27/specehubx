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
        
        // Extract trades from API response (backwards compatible)
        const trades = data.trades || data // Handle both { trades, marketInfo } and legacy array format
        const tradesArray = Array.isArray(trades) ? trades : []
        
        // Map Data API format to our format
        // Data API already filters for $100+ (we set filterAmount=100)
        const allTrades: WhaleTrade[] = tradesArray
          .slice(0, 30) // Show top 30 recent trades
          .map((trade: any, idx: number) => {
            // Data API format:
            // - proxyWallet: user address
            // - side: "BUY" or "SELL"
            // - size: number of shares
            // - price: price per share (0-1)
            // - timestamp: ISO string
            const userAddress = trade.proxyWallet || trade.user || 'unknown'
            const userLabel = userAddress !== 'unknown' 
              ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` 
              : 'unknown'
            
            const size = parseFloat(trade.size || '0')
            const price = parseFloat(trade.price || '0')
            const amount = size * price
            
            return {
              id: `${trade.timestamp}-${idx}`,
              traderAddress: userAddress,
              traderName: userLabel,
              tier: amount > 10000 ? 'S' : amount > 1000 ? 'A' : 'B',
              amount,
              outcome: trade.side === 'BUY' ? 'YES' : 'NO',
              price,
              timestamp: new Date(trade.timestamp).getTime(),
              shares: size,
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
    // Fix: Handle both seconds and milliseconds timestamps
    const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp
    const diff = Date.now() - ts
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (days > 0) return `${days}d`
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

      {/* Footer with MEGA BUBBLES BUTTON 🫧 */}
      <div className="mt-4 pt-3 border-t border-purple-500/30">
        <div className="text-[10px] text-muted-foreground font-mono text-center mb-3">
          {trades.length} trades • Min $100
        </div>
        
        {/* MEGA ANIMATED BUTTON - Center stage! 🌟 */}
        <Link 
          href={`/markets/smart/${marketId}/bubbles`}
          className="group relative block"
        >
          {/* Outer glow container */}
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-lg blur-md opacity-75 group-hover:opacity-100 animate-pulse"></div>
          
          {/* Main button */}
          <div className="relative px-6 py-4 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 hover:from-purple-500 hover:via-pink-500 hover:to-purple-600 text-white pixel-border border-2 border-purple-400 transition-all group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-purple-500/60 active:scale-95 cursor-pointer">
            {/* Animated background bubbles */}
            <div className="absolute inset-0 overflow-hidden rounded opacity-30">
              <div className="absolute top-2 left-4 w-4 h-4 bg-white rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute top-4 right-6 w-3 h-3 bg-white rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
              <div className="absolute bottom-3 left-8 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
              <div className="absolute bottom-4 right-4 w-3 h-3 bg-white rounded-full animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.3s' }} />
            </div>
            
            {/* Button content */}
            <div className="relative flex items-center justify-center gap-3">
              <span className="text-2xl animate-bounce" style={{ animationDuration: '2s' }}>🫧</span>
              <div className="flex flex-col items-start">
                <span className="text-sm font-black tracking-wider uppercase">View Whale Network</span>
                <span className="text-[10px] text-purple-200/80 font-mono">Interactive 3D Bubble Graph</span>
              </div>
              <span className="text-2xl text-yellow-300 group-hover:translate-x-1 transition-transform">→</span>
            </div>
            
            {/* Shine effect on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine"></div>
            </div>
          </div>
        </Link>
        
        <div className="text-[10px] text-purple-400/80 font-mono text-center mt-3 animate-pulse">
          ⚡ See who's trading & how they connect
        </div>
      </div>
    </div>
  )
}
