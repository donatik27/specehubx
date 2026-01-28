'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
})

interface Trade {
  id: string
  maker: string
  side: 'YES' | 'NO'
  price: number
  size: number
  timestamp: number
}

interface GraphNode {
  id: string // wallet address
  name: string // shortened address or nickname
  val: number // size (trade amount)
  color: string // green for YES, red for NO
  side: 'YES' | 'NO'
  amount: number
}

interface GraphLink {
  source: string
  target: string
  value: number // connection strength
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface WhaleNetworkGraphProps {
  marketId: string
  minAmount?: number // Minimum trade amount to show (default $100)
}

export default function WhaleNetworkGraph({ 
  marketId, 
  minAmount = 100 
}: WhaleNetworkGraphProps) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const graphRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphWidth, setGraphWidth] = useState(1200)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextWidth = Math.max(320, Math.floor(entry.contentRect.width))
        setGraphWidth(nextWidth)
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const fetchWhaleNetwork = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all trades for this market from our API proxy (NO FAKE DATA!)
      const response = await fetch(`/api/market-trades?market=${marketId}&limit=1000`)
      const data = await response.json()

      if (!response.ok) {
        const message = data?.message || data?.error || 'Failed to fetch trades from API'
        throw new Error(message)
      }
      console.log('[WhaleNetworkGraph] Raw API response:', data)
      console.log('[WhaleNetworkGraph] Response type:', typeof data)
      console.log('[WhaleNetworkGraph] Is array:', Array.isArray(data))
      
      const trades: any[] = Array.isArray(data) ? data : (data.data ?? [])
      console.log('[WhaleNetworkGraph] Parsed trades:', trades.length)
      
      if (trades.length === 0) {
        console.error('[WhaleNetworkGraph] No trades found. Full response:', JSON.stringify(data))
        throw new Error('No trades available for this market yet')
      }

      // Data API already filters for $100+ (we set filterAmount=100)
      // Build nodes (wallets) - aggregate all trades per wallet
      const walletMap = new Map<string, { 
        amount: number
        yesTrades: number
        noTrades: number
        tradeCount: number
      }>()
      
      trades.forEach((trade: any) => {
        // Data API format: proxyWallet, side, price, size
        const wallet = trade.proxyWallet || trade.user || 'unknown'
        if (wallet === 'unknown') return
        
        const side = trade.side?.toUpperCase()
        const price = parseFloat(trade.price || '0')
        const size = parseFloat(trade.size || '0')
        const amount = price * size

        if (walletMap.has(wallet)) {
          const data = walletMap.get(wallet)!
          data.amount += amount
          data.tradeCount += 1
          if (side === 'BUY') data.yesTrades += amount
          else data.noTrades += amount
        } else {
          walletMap.set(wallet, {
            amount,
            yesTrades: side === 'BUY' ? amount : 0,
            noTrades: side === 'SELL' ? amount : 0,
            tradeCount: 1
          })
        }
      })

      // Filter wallets with at least $100 total volume
      const filteredWallets = Array.from(walletMap.entries())
        .filter(([_, data]) => data.amount >= minAmount)

      // Create nodes
      const nodes: GraphNode[] = filteredWallets.map(([wallet, data]) => {
        // Determine dominant side
        const side: 'YES' | 'NO' = data.yesTrades > data.noTrades ? 'YES' : 'NO'
        
        return {
          id: wallet,
          name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          val: data.amount,
          color: side === 'YES' ? '#22c55e' : '#ef4444',
          side,
          amount: data.amount
        }
      })

      // Build links (market dynamics visualization)
      const links: GraphLink[] = []
      
      // Strategy: Show market tension between YES and NO whales
      const yesNodes = nodes.filter(n => n.side === 'YES').sort((a, b) => b.amount - a.amount)
      const noNodes = nodes.filter(n => n.side === 'NO').sort((a, b) => b.amount - a.amount)

      // Connect top whales across sides (market makers vs market takers)
      const topYesWhales = yesNodes.slice(0, Math.min(8, yesNodes.length))
      const topNoWhales = noNodes.slice(0, Math.min(8, noNodes.length))

      topYesWhales.forEach((yesWhale, i) => {
        topNoWhales.forEach((noWhale, j) => {
          // Stronger connections between top whales
          const strength = 1 / (i + j + 1)
          if (strength > 0.2) {
            links.push({
              source: yesWhale.id,
              target: noWhale.id,
              value: strength
            })
          }
        })
      })

      // Connect similar-sized whales on same side (whale pods)
      const connectSimilarWhales = (whaleNodes: GraphNode[]) => {
        whaleNodes.forEach((whale, i) => {
          const similarWhales = whaleNodes.slice(i + 1, i + 4) // Connect to next 3
          similarWhales.forEach(similar => {
            const sizeDiff = Math.abs(whale.amount - similar.amount)
            const avgSize = (whale.amount + similar.amount) / 2
            
            if (sizeDiff / avgSize < 0.5) {
              links.push({
                source: whale.id,
                target: similar.id,
                value: 0.3
              })
            }
          })
        })
      }

      connectSimilarWhales(yesNodes)
      connectSimilarWhales(noNodes)

      setGraphData({ nodes, links })
      setLoading(false)

    } catch (err) {
      console.error('Failed to fetch whale network:', err)
      setError('Failed to load whale network')
      setLoading(false)
    }
  }, [marketId, minAmount])

  useEffect(() => {
    fetchWhaleNetwork()
  }, [fetchWhaleNetwork])

  const handleNodeClick = useCallback((node: any) => {
    // Open Polymarket profile
    window.open(`https://polymarket.com/profile/${node.id}`, '_blank')
  }, [])

  if (loading) {
    return (
      <div className="bg-card pixel-border border-[#22c55e]/40 p-6">
        <div className="flex items-center justify-center h-[600px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading whale network...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card pixel-border border-red-500/40 p-6">
        <div className="text-center text-red-500">
          <p className="font-bold mb-2">⚠️ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card pixel-border border-[#22c55e]/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-[#22c55e] font-mono">
            🌊 WHALE_NETWORK_GRAPH
          </h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {graphData.nodes.length} wallets • {graphData.links.length} connections • Min ${minAmount}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
            <span>YES</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
            <span>NO</span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="relative bg-black/40 pixel-border border-white/10 overflow-hidden"
      >
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={graphWidth}
          height={600}
          backgroundColor="rgba(0,0,0,0.8)"
          nodeLabel={(node: any) => `
            <div style="background: rgba(0,0,0,0.9); padding: 8px; border: 1px solid ${node.color}; border-radius: 4px; font-family: monospace;">
              <div style="color: ${node.color}; font-weight: bold; margin-bottom: 4px;">${node.side}</div>
              <div style="color: white; font-size: 12px;">${node.name}</div>
              <div style="color: #22c55e; font-size: 14px; font-weight: bold;">$${(node.amount / 1000).toFixed(1)}K</div>
            </div>
          `}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val / 100} // Scale down for better visualization
          nodeRelSize={6}
          linkColor={() => 'rgba(255,255,255,0.1)'}
          linkWidth={(link: any) => link.value}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.005}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          d3VelocityDecay={0.3}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 p-3 bg-black/20 pixel-border border-white/10">
        <p className="text-xs text-muted-foreground font-mono">
          💡 <span className="text-white">TIP:</span> Click on any wallet to view on Polymarket • 
          Larger bubbles = bigger trades • Lines = connections between whales
        </p>
      </div>
    </div>
  )
}
