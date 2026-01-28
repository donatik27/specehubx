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
  fx?: number // fixed x position (for Market Hub)
  fy?: number // fixed y position (for Market Hub)
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
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })

  // Track window size for fullscreen
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
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

      // Create whale nodes and separate by side
      const whaleNodesData = filteredWallets.map(([wallet, data]) => {
        const side: 'YES' | 'NO' = data.yesTrades > data.noTrades ? 'YES' : 'NO'
        
        let tier = 'B'
        let tierIndex = 3
        let color = side === 'YES' ? '#22c55e' : '#ef4444'
        
        if (data.amount > 10000) {
          tier = 'S'
          tierIndex = 1
          color = side === 'YES' ? '#10b981' : '#dc2626'
        } else if (data.amount > 1000) {
          tier = 'A'
          tierIndex = 2
          color = side === 'YES' ? '#16a34a' : '#e11d48'
        }
        
        return {
          wallet,
          data,
          side,
          tier,
          tierIndex,
          color,
          amount: data.amount
        }
      })
      
      // Separate and sort by side and amount
      const yesWhales = whaleNodesData.filter(w => w.side === 'YES').sort((a, b) => b.amount - a.amount)
      const noWhales = whaleNodesData.filter(w => w.side === 'NO').sort((a, b) => b.amount - a.amount)
      
      // CIRCULAR LAYOUT ALGORITHM
      const whaleNodes: GraphNode[] = []
      
      // Layout YES whales (LEFT semi-circle: 90° to 270°)
      yesWhales.forEach((whale, index) => {
        const ringRadius = 150 + (whale.tierIndex * 180) // Inner ring = S-tier, outer = B-tier
        const angleStart = Math.PI / 2  // 90° (top)
        const angleEnd = (3 * Math.PI) / 2 // 270° (bottom)
        const angleRange = angleEnd - angleStart
        const angle = angleStart + (angleRange * (index / Math.max(yesWhales.length - 1, 1)))
        
        whaleNodes.push({
          id: whale.wallet,
          name: `${whale.wallet.slice(0, 6)}...${whale.wallet.slice(-4)}`,
          val: whale.amount,
          color: whale.color,
          side: 'YES',
          amount: whale.amount,
          fx: Math.cos(angle) * ringRadius,
          fy: Math.sin(angle) * ringRadius
        })
      })
      
      // Layout NO whales (RIGHT semi-circle: -90° to 90°)
      noWhales.forEach((whale, index) => {
        const ringRadius = 150 + (whale.tierIndex * 180)
        const angleStart = -Math.PI / 2 // -90° (top)
        const angleEnd = Math.PI / 2    // 90° (bottom)
        const angleRange = angleEnd - angleStart
        const angle = angleStart + (angleRange * (index / Math.max(noWhales.length - 1, 1)))
        
        whaleNodes.push({
          id: whale.wallet,
          name: `${whale.wallet.slice(0, 6)}...${whale.wallet.slice(-4)}`,
          val: whale.amount,
          color: whale.color,
          side: 'NO',
          amount: whale.amount,
          fx: Math.cos(angle) * ringRadius,
          fy: Math.sin(angle) * ringRadius
        })
      })

      // Calculate max whale size for hub sizing
      const maxWhaleAmount = Math.max(...whaleNodes.map(n => n.amount), 1000)
      
      // Calculate total trade volume from actual trades
      const totalTradeVolume = whaleNodes.reduce((sum, node) => sum + node.amount, 0)

      // Create MARKET HUB (центральний node) - BIGGEST NODE
      const marketHub: GraphNode = {
        id: 'MARKET_HUB',
        name: marketTitle.length > 50 ? marketTitle.slice(0, 50) + '...' : marketTitle,
        val: maxWhaleAmount * 8, // 8x bigger than biggest whale! (was 5x)
        color: '#a855f7', // Purple
        side: 'YES', // Neutral
        amount: marketVolume > 0 ? marketVolume : totalTradeVolume,
        fx: 0, // Fixed at center X
        fy: 0  // Fixed at center Y
      }

      // Combine all nodes (hub first for rendering order)
      const nodes = [marketHub, ...whaleNodes]

      // Build links - CIRCULAR STRUCTURE
      const links: GraphLink[] = []
      
      // Get YES and NO nodes (already sorted from above)
      const yesNodes = whaleNodes.filter(n => n.side === 'YES')
      const noNodes = whaleNodes.filter(n => n.side === 'NO')

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
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <span className="ml-3 text-sm text-muted-foreground font-mono">Loading whale network...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-red-500 pixel-border border-red-500/40 p-8 bg-black/80">
          <p className="font-bold mb-2 text-2xl">⚠️ Error</p>
          <p className="text-sm font-mono">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Floating Stats (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 px-4 py-2">
        <div className="text-xs font-mono text-muted-foreground">
          <span className="text-purple-400 font-bold">{graphData.nodes.length - 1}</span> whales •{' '}
          <span className="text-purple-400 font-bold">{graphData.links.length}</span> connections
        </div>
      </div>

      {/* FULLSCREEN Graph */}
      <div className="w-full h-full">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#000000"
          nodeLabel={(node: any) => {
            // Special label for Market Hub
            if (node.id === 'MARKET_HUB') {
              const volumeText = node.amount > 1000000 
                ? `$${(node.amount / 1000000).toFixed(2)}M`
                : `$${(node.amount / 1000).toFixed(0)}K`
              
              return `
                <div style="background: rgba(168,85,247,0.95); padding: 16px; border: 3px solid #a855f7; border-radius: 12px; font-family: monospace; backdrop-filter: blur(12px); box-shadow: 0 0 30px rgba(168,85,247,0.5);">
                  <div style="color: white; font-weight: bold; font-size: 16px; margin-bottom: 8px; text-align: center;">🎯 MARKET HUB</div>
                  <div style="color: #e9d5ff; font-size: 11px; margin-bottom: 6px; max-width: 250px;">${node.name}</div>
                  <div style="color: #22c55e; font-size: 20px; font-weight: bold; text-align: center;">${volumeText}</div>
                  <div style="color: #c4b5fd; font-size: 10px; margin-top: 4px; text-align: center;">Total Volume</div>
                </div>
              `
            }
            
            // Regular whale label
            const amountText = node.amount > 1000 
              ? `$${(node.amount / 1000).toFixed(1)}K`
              : `$${node.amount.toFixed(0)}`
            
            return `
              <div style="background: rgba(0,0,0,0.95); padding: 10px; border: 2px solid ${node.color}; border-radius: 6px; font-family: monospace; box-shadow: 0 0 15px ${node.color}40;">
                <div style="color: ${node.color}; font-weight: bold; margin-bottom: 4px; font-size: 11px;">${node.side} WHALE</div>
                <div style="color: white; font-size: 11px; margin-bottom: 4px;">${node.name}</div>
                <div style="color: #22c55e; font-size: 14px; font-weight: bold;">${amountText}</div>
              </div>
            `
          }}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => {
            // Market Hub is MUCH larger
            if (node.id === 'MARKET_HUB') {
              return node.val / 50 // Make hub stand out even more
            }
            return node.val / 100
          }}
          nodeRelSize={10} // Larger base size
          nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
            // Custom rendering for Market Hub
            if (node.id === 'MARKET_HUB') {
              const label = '🎯'
              const fontSize = 30 / globalScale
              ctx.font = `${fontSize}px Sans-Serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(label, node.x, node.y)
              
              // Glow effect
              ctx.beginPath()
              ctx.arc(node.x, node.y, (node.val / 50) * 1.2, 0, 2 * Math.PI, false)
              ctx.fillStyle = 'rgba(168,85,247,0.1)'
              ctx.fill()
            }
          }}
          linkColor={(link: any) => {
            // Stronger color for hub connections
            if (link.source.id === 'MARKET_HUB' || link.target.id === 'MARKET_HUB') {
              return 'rgba(168,85,247,0.4)'
            }
            return 'rgba(255,255,255,0.08)'
          }}
          linkWidth={(link: any) => link.value * 1.5}
          linkDirectionalParticles={(link: any) => {
            // More particles for hub connections
            if (link.source.id === 'MARKET_HUB' || link.target.id === 'MARKET_HUB') {
              return 4
            }
            return 2
          }}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleSpeed={0.003}
          linkDirectionalParticleColor={(link: any) => {
            if (link.source.id === 'MARKET_HUB' || link.target.id === 'MARKET_HUB') {
              return 'rgba(168,85,247,0.6)'
            }
            return 'rgba(255,255,255,0.3)'
          }}
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => {
            document.body.style.cursor = node ? 'pointer' : 'default'
          }}
          enableNodeDrag={false} // Disable drag to keep circular layout
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={0} // No simulation needed - we have fixed positions
          warmupTicks={0}
        />
      </div>
    </div>
  )
}
