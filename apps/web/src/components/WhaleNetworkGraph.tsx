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

      // Filter wallets with at least minAmount, sort by size, take TOP 50 only!
      const filteredWallets = Array.from(walletMap.entries())
        .filter(([_, data]) => data.amount >= minAmount)
        .sort(([_, a], [__, b]) => b.amount - a.amount) // Sort by amount (biggest first)
        .slice(0, 50) // TOP 50 WHALES ONLY!

      console.log(`🐋 Showing top ${filteredWallets.length} whales (min $${minAmount})`)

      // Separate YES and NO whales
      const yesWhales = filteredWallets.filter(([_, data]) => data.yesTrades > data.noTrades)
      const noWhales = filteredWallets.filter(([_, data]) => data.noTrades >= data.yesTrades)
      
      // Create whale nodes with FIXED CIRCULAR POSITIONS
      const whaleNodes: GraphNode[] = []
      
      // Position YES whales (LEFT semi-circle)
      yesWhales.forEach(([wallet, data], index) => {
        const side = 'YES'
        const color = data.amount > 10000 ? '#10b981' : data.amount > 1000 ? '#16a34a' : '#22c55e'
        
        // Circular positioning - LEFT SEMI (90° to 270°)
        const totalYes = yesWhales.length
        const angleStart = Math.PI / 2  // 90°
        const angleEnd = (3 * Math.PI) / 2 // 270°
        const angle = angleStart + ((angleEnd - angleStart) * (index / Math.max(totalYes - 1, 1)))
        
        const radius = 300 // Fixed radius
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        
        whaleNodes.push({
          id: wallet,
          name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          val: data.amount,
          color,
          side: 'YES',
          amount: data.amount,
          fx: x, // FIXED X - doesn't move!
          fy: y  // FIXED Y - doesn't move!
        })
      })
      
      // Position NO whales (RIGHT semi-circle)
      noWhales.forEach(([wallet, data], index) => {
        const side = 'NO'
        const color = data.amount > 10000 ? '#dc2626' : data.amount > 1000 ? '#e11d48' : '#ef4444'
        
        // Circular positioning - RIGHT SEMI (-90° to 90°)
        const totalNo = noWhales.length
        const angleStart = -Math.PI / 2  // -90°
        const angleEnd = Math.PI / 2     // 90°
        const angle = angleStart + ((angleEnd - angleStart) * (index / Math.max(totalNo - 1, 1)))
        
        const radius = 300
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        
        whaleNodes.push({
          id: wallet,
          name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          val: data.amount,
          color,
          side: 'NO',
          amount: data.amount,
          fx: x, // FIXED X
          fy: y  // FIXED Y
        })
      })

      // Calculate max whale size for hub sizing
      const maxWhaleAmount = Math.max(...whaleNodes.map(n => n.amount), 1000)
      
      // Calculate total trade volume from actual trades
      const totalTradeVolume = whaleNodes.reduce((sum, node) => sum + node.amount, 0)

      // Create MARKET HUB - FIXED CENTER (can be dragged manually)
      const marketHub: GraphNode = {
        id: 'MARKET_HUB',
        name: marketTitle.length > 50 ? marketTitle.slice(0, 50) + '...' : marketTitle,
        val: maxWhaleAmount * 10, // 10x bigger - DOMINANT!
        color: '#a855f7', // Purple
        side: 'YES', // Neutral
        amount: marketVolume > 0 ? marketVolume : totalTradeVolume,
        fx: 0, // FIXED at center
        fy: 0  // FIXED at center
      }

      // Combine all nodes (hub first for rendering order)
      const nodes = [marketHub, ...whaleNodes]

      // Build links - ORGANIC NETWORK STRUCTURE
      const links: GraphLink[] = []
      
      // Separate YES and NO whales, sort by amount
      const yesNodes = whaleNodes.filter(n => n.side === 'YES').sort((a, b) => b.amount - a.amount)
      const noNodes = whaleNodes.filter(n => n.side === 'NO').sort((a, b) => b.amount - a.amount)

      // STRATEGY 1: Connect ONLY BIG whales to MARKET HUB
      // (не всі, тільки великі позиції!)
      whaleNodes.forEach(whale => {
        // Only connect if position > $1000
        if (whale.amount > 1000) {
          const strength = Math.min(whale.amount / 3000, 2)
          links.push({
            source: 'MARKET_HUB',
            target: whale.id,
            value: strength
          })
        }
      })

      // STRATEGY 2: Connect similar-sized whales (pods)
      // Це створює кластери схожих позицій
      const connectSimilarSized = (nodes: GraphNode[]) => {
        nodes.forEach((whale, i) => {
          // Connect to next 2-3 similar sized whales
          const similar = nodes.slice(i + 1, i + 4)
          similar.forEach(other => {
            const sizeDiff = Math.abs(whale.amount - other.amount)
            const avgSize = (whale.amount + other.amount) / 2
            
            // Only connect if sizes are within 50% of each other
            if (sizeDiff / avgSize < 0.5) {
              links.push({
                source: whale.id,
                target: other.id,
                value: 0.3
              })
            }
          })
        })
      }
      
      connectSimilarSized(yesNodes)
      connectSimilarSized(noNodes)

      // STRATEGY 3: Connect top YES vs top NO (market tension)
      // Показує протистояння між сторонами
      const topYes = yesNodes.slice(0, 3)
      const topNo = noNodes.slice(0, 3)
      
      topYes.forEach(yesWhale => {
        topNo.forEach(noWhale => {
          links.push({
            source: yesWhale.id,
            target: noWhale.id,
            value: 0.2 // Weak tension link
          })
        })
      })

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
              return node.val / 20 // BIGGER hub!
            }
            return node.val / 30 // Bigger whales too!
          }}
          nodeRelSize={15} // Even larger base size!
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
          enableNodeDrag={true} // Can drag manually
          enableZoomInteraction={true}
          enablePanInteraction={true}
          cooldownTicks={0} // NO SIMULATION - STATIC!
          warmupTicks={0}
          onNodeDragEnd={(node: any) => {
            // When dragging ends, fix the node at new position
            node.fx = node.x
            node.fy = node.y
          }}
        />
      </div>
    </div>
  )
}
