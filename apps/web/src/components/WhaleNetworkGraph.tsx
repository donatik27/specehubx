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

      // Step 1: Fetch market info for hub (with fallback)
      let marketTitle = 'Market'
      let marketVolume = 0
      
      try {
        const marketInfoResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
          cache: 'no-store'
        })
        if (marketInfoResponse.ok) {
          const marketInfo = await marketInfoResponse.json()
          marketTitle = marketInfo.question || 'Market'
          marketVolume = parseFloat(marketInfo.volume || marketInfo.volumeNum || '0')
        }
      } catch (err) {
        console.warn('[WhaleNetworkGraph] Failed to fetch market info, using fallback:', err)
      }

      // Step 2: Fetch all trades for this market from our API proxy
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

      // Create whale nodes
      const whaleNodes: GraphNode[] = filteredWallets.map(([wallet, data]) => {
        // Determine dominant side
        const side: 'YES' | 'NO' = data.yesTrades > data.noTrades ? 'YES' : 'NO'
        
        // Determine tier based on amount
        let tier = 'B'
        let color = side === 'YES' ? '#22c55e' : '#ef4444'
        
        if (data.amount > 10000) {
          tier = 'S'
          color = side === 'YES' ? '#10b981' : '#dc2626' // Brighter for S tier
        } else if (data.amount > 1000) {
          tier = 'A'
          color = side === 'YES' ? '#16a34a' : '#e11d48'
        }
        
        return {
          id: wallet,
          name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          val: data.amount,
          color,
          side,
          amount: data.amount
        }
      })

      // Calculate max whale size for hub sizing
      const maxWhaleAmount = Math.max(...whaleNodes.map(n => n.amount), 1000)

      // Create MARKET HUB (центральний node)
      const marketHub: GraphNode = {
        id: 'MARKET_HUB',
        name: marketTitle.length > 30 ? marketTitle.slice(0, 30) + '...' : marketTitle,
        val: maxWhaleAmount * 5, // 5x bigger than biggest whale!
        color: '#a855f7', // Purple
        side: 'YES', // Neutral
        amount: marketVolume
      }

      // Combine all nodes
      const nodes = [marketHub, ...whaleNodes]

      // Build links - HIERARCHICAL STRUCTURE
      const links: GraphLink[] = []
      
      // Separate YES and NO whales (exclude hub)
      const yesNodes = whaleNodes.filter(n => n.side === 'YES').sort((a, b) => b.amount - a.amount)
      const noNodes = whaleNodes.filter(n => n.side === 'NO').sort((a, b) => b.amount - a.amount)

      // TIER 1: Connect MARKET HUB to all S-tier whales (strongest connections)
      const sTierWhales = whaleNodes.filter(n => n.amount > 10000)
      sTierWhales.forEach(whale => {
        links.push({
          source: 'MARKET_HUB',
          target: whale.id,
          value: 2.0 // Strong connection
        })
      })

      // TIER 2: Connect HUB to A-tier whales if no S-tier exists
      if (sTierWhales.length < 3) {
        const aTierWhales = whaleNodes.filter(n => n.amount > 1000 && n.amount <= 10000).slice(0, 5)
        aTierWhales.forEach(whale => {
          links.push({
            source: 'MARKET_HUB',
            target: whale.id,
            value: 1.0
          })
        })
      }

      // TIER 3: YES ↔️ NO market tension (top whales)
      const topYesWhales = yesNodes.slice(0, Math.min(5, yesNodes.length))
      const topNoWhales = noNodes.slice(0, Math.min(5, noNodes.length))

      topYesWhales.forEach((yesWhale, i) => {
        topNoWhales.forEach((noWhale, j) => {
          if (i + j < 4) { // Only strongest connections
            links.push({
              source: yesWhale.id,
              target: noWhale.id,
              value: 0.5
            })
          }
        })
      })

      // TIER 4: Whale pods (same side clusters)
      const connectSimilarWhales = (whaleNodes: GraphNode[]) => {
        whaleNodes.forEach((whale, i) => {
          const similarWhales = whaleNodes.slice(i + 1, i + 3) // Connect to next 2
          similarWhales.forEach(similar => {
            links.push({
              source: whale.id,
              target: similar.id,
              value: 0.2
            })
          })
        })
      }

      connectSimilarWhales(yesNodes.slice(0, 10))
      connectSimilarWhales(noNodes.slice(0, 10))

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
    // Market Hub - open market page
    if (node.id === 'MARKET_HUB') {
      window.open(`https://polymarket.com/event/${marketId}`, '_blank')
      return
    }
    
    // Whale - open profile
    window.open(`https://polymarket.com/profile/${node.id}`, '_blank')
  }, [marketId])

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
          nodeLabel={(node: any) => {
            // Special label for Market Hub
            if (node.id === 'MARKET_HUB') {
              return `
                <div style="background: rgba(168,85,247,0.2); padding: 12px; border: 2px solid #a855f7; border-radius: 8px; font-family: monospace; backdrop-filter: blur(8px);">
                  <div style="color: #a855f7; font-weight: bold; font-size: 14px; margin-bottom: 6px;">🎯 MARKET HUB</div>
                  <div style="color: white; font-size: 12px; margin-bottom: 4px;">${node.name}</div>
                  <div style="color: #22c55e; font-size: 16px; font-weight: bold;">$${(node.amount / 1000000).toFixed(2)}M</div>
                  <div style="color: #a855f7; font-size: 10px; margin-top: 4px;">Total Volume</div>
                </div>
              `
            }
            
            // Regular whale label
            return `
              <div style="background: rgba(0,0,0,0.9); padding: 8px; border: 1px solid ${node.color}; border-radius: 4px; font-family: monospace;">
                <div style="color: ${node.color}; font-weight: bold; margin-bottom: 4px;">${node.side}</div>
                <div style="color: white; font-size: 12px;">${node.name}</div>
                <div style="color: #22c55e; font-size: 14px; font-weight: bold;">$${(node.amount / 1000).toFixed(1)}K</div>
              </div>
            `
          }}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val / 100} // Scale down for better visualization
          nodeRelSize={8} // Larger nodes for better visibility
          linkColor={(link: any) => {
            // Stronger color for hub connections
            if (link.source.id === 'MARKET_HUB' || link.target.id === 'MARKET_HUB') {
              return 'rgba(168,85,247,0.3)'
            }
            return 'rgba(255,255,255,0.1)'
          }}
          linkWidth={(link: any) => link.value}
          linkDirectionalParticles={(link: any) => {
            // More particles for hub connections
            if (link.source.id === 'MARKET_HUB' || link.target.id === 'MARKET_HUB') {
              return 3
            }
            return 1
          }}
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
