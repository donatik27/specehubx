'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import Draggable, { DraggableData } from 'react-draggable'
import { motion } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import * as d3 from 'd3-force'

type TierType = 'S' | 'A' | 'B'

interface WhaleBubble {
  id: string // wallet address
  wallet: string
  amount: number
  side: 'YES' | 'NO'
  color: string
  size: number // pixel size for bubble
  x: number // position x for connections (from getBoundingClientRect)
  y: number // position y for connections (from getBoundingClientRect)
  tier: TierType // S (top 15%), A (16-50%), B (50%+)
}

interface TierConfig {
  name: TierType
  radiusMin: number
  radiusMax: number
  color: string // for debug/visualization
}

const TIER_CONFIGS: TierConfig[] = [
  { name: 'S', radiusMin: 550, radiusMax: 600, color: '#fbbf24' }, // Gold - elite whales
  { name: 'A', radiusMin: 650, radiusMax: 700, color: '#a78bfa' }, // Purple - mid tier
  { name: 'B', radiusMin: 700, radiusMax: 850, color: '#60a5fa' }, // Blue - outer ring
]

interface MarketHub {
  x: number
  y: number
}

interface WhaleNetworkGraphProps {
  marketId: string
  minAmount?: number
}

// Calculate dynamic tier thresholds based on percentiles
function calculateTierThresholds(whales: { amount: number }[]): { S: number; A: number } {
  if (whales.length === 0) return { S: 0, A: 0 }
  
  const sorted = [...whales].sort((a, b) => b.amount - a.amount)
  
  // Tier S: Top 15%
  const tierSIndex = Math.floor(sorted.length * 0.15)
  const tierSThreshold = sorted[Math.max(0, tierSIndex - 1)]?.amount || 0
  
  // Tier A: Top 16-50% (so threshold is at 50% mark)
  const tierAIndex = Math.floor(sorted.length * 0.50)
  const tierAThreshold = sorted[Math.max(0, tierAIndex - 1)]?.amount || 0
  
  return { S: tierSThreshold, A: tierAThreshold }
}

// Assign tier to a whale based on amount and thresholds
function assignTier(amount: number, thresholds: { S: number; A: number }): TierType {
  if (amount >= thresholds.S) return 'S'
  if (amount >= thresholds.A) return 'A'
  return 'B'
}

export default function WhaleNetworkGraph({ 
  marketId, 
  minAmount = 1000 
}: WhaleNetworkGraphProps) {
  const [marketInfo, setMarketInfo] = useState<{ title: string; volume: number; image: string } | null>(null)
  const [yesWhales, setYesWhales] = useState<WhaleBubble[]>([])
  const [noWhales, setNoWhales] = useState<WhaleBubble[]>([])
  const [marketHub, setMarketHub] = useState<MarketHub>({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredWhaleId, setHoveredWhaleId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false) // Track drag state for hover persistence
  
  // Controlled positions for group drag functionality
  const [whalePositions, setWhalePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [hubPosition, setHubPosition] = useState({ x: 0, y: 0 })
  const [positionsInitialized, setPositionsInitialized] = useState(false)
  
  // Velocity tracking for fluid lines (як віровок! 🪢)
  const [whaleVelocities, setWhaleVelocities] = useState<Map<string, { vx: number; vy: number }>>(new Map())
  const lastPositionsRef = useRef<Map<string, { x: number; y: number; timestamp: number }>>(new Map())
  
  const hubRef = useRef<HTMLDivElement>(null)
  const whaleRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  
  // D3 Force Simulation (Arkham-style! 🔥)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)

  const fetchWhaleNetwork = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Step 1: Fetch market info
      let marketTitle = 'Market'
      let marketVolume = 0
      let marketImage = ''
      
      try {
        const marketInfoResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
          cache: 'no-store'
        })
        if (marketInfoResponse.ok) {
          const marketInfo = await marketInfoResponse.json()
          marketTitle = marketInfo.question || 'Market'
          marketVolume = parseFloat(marketInfo.volume || marketInfo.volumeNum || '0')
          marketImage = marketInfo.image || marketInfo.icon || ''
        }
      } catch (err) {
        console.warn('[WhaleNetworkGraph] Failed to fetch market info:', err)
      }

      // Step 2: Fetch trades
      const response = await fetch(`/api/market-trades?market=${marketId}&limit=1000`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to fetch trades')
      }
      
      const trades: any[] = Array.isArray(data) ? data : []
      
      if (trades.length === 0) {
        throw new Error('No trades available for this market yet')
      }

      // Aggregate trades per wallet
      const walletMap = new Map<string, { 
        amount: number
        yesTrades: number
        noTrades: number
      }>()
      
      trades.forEach((trade: any) => {
        const wallet = trade.proxyWallet || trade.user || 'unknown'
        if (wallet === 'unknown') return

        // Use outcome to determine YES/NO
        const outcomeRaw = String(trade.outcome || '').toLowerCase()
        let outcomeSide: 'YES' | 'NO' | null = null
        if (trade.outcomeIndex === 0 || outcomeRaw === 'yes') outcomeSide = 'YES'
        if (trade.outcomeIndex === 1 || outcomeRaw === 'no') outcomeSide = 'NO'
        if (!outcomeSide) return

        const price = parseFloat(trade.price || '0')
        const size = parseFloat(trade.size || '0')
        const amount = price * size

        if (walletMap.has(wallet)) {
          const data = walletMap.get(wallet)!
          data.amount += amount
          if (outcomeSide === 'YES') data.yesTrades += amount
          else data.noTrades += amount
        } else {
          walletMap.set(wallet, {
            amount,
            yesTrades: outcomeSide === 'YES' ? amount : 0,
            noTrades: outcomeSide === 'NO' ? amount : 0,
          })
        }
      })

      // Filter and sort - TOP 30 whales for cleaner look
      const filteredWallets = Array.from(walletMap.entries())
        .filter(([_, data]) => data.amount >= minAmount)
        .sort(([_, a], [__, b]) => b.amount - a.amount)
        .slice(0, 30)

      console.log(`🐋 Showing top ${filteredWallets.length} whales (min $${minAmount})`)

      // Calculate dynamic tier thresholds for ALL whales
      const allAmounts = filteredWallets.map(([_, data]) => ({ amount: data.amount }))
      const tierThresholds = calculateTierThresholds(allAmounts)
      console.log(`📊 Tier thresholds: S >= $${tierThresholds.S.toFixed(0)}, A >= $${tierThresholds.A.toFixed(0)}`)

      // Create bubbles with sizes and tiers
      const bubbles: WhaleBubble[] = filteredWallets.map(([wallet, data]) => {
        const side: 'YES' | 'NO' = data.yesTrades > data.noTrades ? 'YES' : 'NO'
        const tier = assignTier(data.amount, tierThresholds)
        
        // Color based on side and amount
        let color = side === 'YES' ? '#22c55e' : '#ef4444'
        if (data.amount > 10000) {
          color = side === 'YES' ? '#10b981' : '#dc2626'
        } else if (data.amount > 5000) {
          color = side === 'YES' ? '#16a34a' : '#e11d48'
        }
        
        // Calculate bubble size (80px to 150px for better visibility)
        const minSize = 80
        const maxSize = 150
        const maxAmount = Math.max(...filteredWallets.map(([_, d]) => d.amount))
        const size = minSize + ((data.amount / maxAmount) * (maxSize - minSize))
        
        return {
          id: wallet,
          wallet,
          amount: data.amount,
          side,
          color,
          size: Math.round(size),
          x: 0, // Will be calculated from DOM
          y: 0,  // Will be calculated from DOM
          tier
        }
      })

      // Separate YES and NO
      const yes = bubbles.filter(b => b.side === 'YES')
      const no = bubbles.filter(b => b.side === 'NO')

      setMarketInfo({ title: marketTitle, volume: marketVolume, image: marketImage })
      setYesWhales(yes)
      setNoWhales(no)
      setLoading(false)

    } catch (err) {
      console.error('Failed to fetch whale network:', err)
      setError('Failed to load whale network')
      setLoading(false)
    }
  }, [marketId, minAmount])

  // Update positions from DOM
  const updatePositions = useCallback(() => {
    console.log('🔄 updatePositions called!')
    
    // Update Hub position
    if (hubRef.current) {
      const rect = hubRef.current.getBoundingClientRect()
      const hubPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
      console.log('🎯 Hub position:', hubPos)
      setMarketHub(hubPos)
    } else {
      console.warn('❌ Hub ref not found!')
    }

    // Update whale positions using FUNCTIONAL UPDATE to avoid infinite loop!
    console.log('🐋 Updating whale positions...')
    console.log('  Refs map size:', whaleRefs.current.size)

    setYesWhales(prev => {
      console.log('  YES whales:', prev.length)
      return prev.map(whale => {
        const ref = whaleRefs.current.get(whale.id)
        if (ref) {
          const rect = ref.getBoundingClientRect()
          const pos = {
            ...whale,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
          console.log(`  ✅ YES whale ${whale.id.slice(0, 8)}: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`)
          return pos
        }
        console.warn(`  ❌ YES whale ${whale.id.slice(0, 8)}: ref not found!`)
        return whale
      })
    })

    setNoWhales(prev => {
      console.log('  NO whales:', prev.length)
      return prev.map(whale => {
        const ref = whaleRefs.current.get(whale.id)
        if (ref) {
          const rect = ref.getBoundingClientRect()
          const pos = {
            ...whale,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
          console.log(`  ✅ NO whale ${whale.id.slice(0, 8)}: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`)
          return pos
        }
        console.warn(`  ❌ NO whale ${whale.id.slice(0, 8)}: ref not found!`)
        return whale
      })
    })

    console.log('📊 Positions updated!')
  }, []) // EMPTY DEPENDENCIES - no infinite loop!

  // Handle whale drag - D3 FORCE-BASED (Arkham-style! 🔥)
  const handleWhaleDrag = useCallback((whale: WhaleBubble, data: DraggableData) => {
    if (!simulationRef.current) return
    
    // Track dragging state (для hover persistence!)
    setIsDragging(true)
    
    // Find the node in D3 simulation
    const node = simulationRef.current.nodes().find((n: any) => n.id === whale.id)
    if (!node) return
    
    // Calculate velocity for fluid lines! 🌊
    const now = Date.now()
    const lastPos = lastPositionsRef.current.get(whale.id)
    if (lastPos) {
      const dt = (now - lastPos.timestamp) / 1000 // seconds
      if (dt > 0) {
        const centerX = data.x + whale.size / 2
        const centerY = data.y + whale.size / 2
        const vx = (centerX - lastPos.x) / dt
        const vy = (centerY - lastPos.y) / dt
        
        setWhaleVelocities(prev => {
          const newVelocities = new Map(prev)
          newVelocities.set(whale.id, { vx, vy })
          return newVelocities
        })
      }
    }
    
    // Save current position for next velocity calc
    const centerX = data.x + whale.size / 2
    const centerY = data.y + whale.size / 2
    lastPositionsRef.current.set(whale.id, { x: centerX, y: centerY, timestamp: now })
    
    // Update D3 node fixed position (D3 will handle the rest! 🔥)
    node.fx = centerX
    node.fy = centerY
    
    // Reheat simulation (make it active again!)
    simulationRef.current.alphaTarget(0.3).restart()
  }, [])

  // Handle hub drag - D3 FORCE-BASED (Arkham-style! 🔥)
  const handleHubDrag = useCallback((data: DraggableData) => {
    if (!simulationRef.current) return
    
    // Find the hub node in D3 simulation
    const hubNode = simulationRef.current.nodes().find((n: any) => n.id === 'hub')
    if (!hubNode) return
    
    // Update D3 hub node fixed position
    const centerX = data.x + 125 // Hub size = 250px, center = 125px
    const centerY = data.y + 125
    hubNode.fx = centerX
    hubNode.fy = centerY
    
    // Reheat simulation (all whales will follow through links! 🔥)
    simulationRef.current.alphaTarget(0.3).restart()
  }, [])

  useEffect(() => {
    fetchWhaleNetwork()
  }, [fetchWhaleNetwork])

  // Initialize whale positions when whales are loaded
  useEffect(() => {
    const totalWhales = yesWhales.length + noWhales.length
    if (loading || positionsInitialized || totalWhales === 0) return
    
    console.log('🎯 Initializing whale positions...')
    const currentWhales = [...yesWhales, ...noWhales]
    const newWhalePositions = new Map<string, { x: number; y: number }>()
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 800
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400
    
    // Initialize Hub position
    setHubPosition({ 
      x: screenCenterX - 125, 
      y: screenCenterY - 125 
    })
    
    // Initialize each whale position based on tier
    currentWhales.forEach((whale, index) => {
      const tierConfig = TIER_CONFIGS.find(t => t.name === whale.tier) || TIER_CONFIGS[2]
      const baseRadius = (tierConfig.radiusMin + tierConfig.radiusMax) / 2
      
      const angleStep = (2 * Math.PI) / currentWhales.length
      const angle = index * angleStep
      
      const radiusOffset = (Math.random() - 0.5) * (tierConfig.radiusMax - tierConfig.radiusMin) * 3 // 3x chaos!
      const angleOffset = (Math.random() - 0.5) * 2.0 // 2x angular chaos!
      const finalRadius = baseRadius + radiusOffset
      const finalAngle = angle + angleOffset
      
      // Additional XY randomness to prevent overlapping!
      const extraXOffset = (Math.random() - 0.5) * 100 // ±50px X
      const extraYOffset = (Math.random() - 0.5) * 100 // ±50px Y
      
      const x = screenCenterX + Math.cos(finalAngle) * finalRadius - whale.size / 2 + extraXOffset
      const y = screenCenterY + Math.sin(finalAngle) * finalRadius - whale.size / 2 + extraYOffset
      
      newWhalePositions.set(whale.id, { x, y })
    })
    
    setWhalePositions(newWhalePositions)
    setPositionsInitialized(true)
    console.log(`✅ Initialized ${newWhalePositions.size} whale positions!`)
  }, [loading, yesWhales, noWhales, positionsInitialized])

  // Update positions after render and on window resize
  useEffect(() => {
    if (loading) return
    
    const timer = setTimeout(() => {
      updatePositions()
    }, 100)

    window.addEventListener('resize', updatePositions)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePositions)
    }
  }, [loading, updatePositions])

  // 🔥 D3 FORCE SIMULATION (Arkham-style!) 🔥
  useEffect(() => {
    if (!positionsInitialized || loading) return
    if (yesWhales.length === 0 && noWhales.length === 0) return
    
    console.log('🚀 Initializing D3 Force Simulation!')
    const currentWhales = [...yesWhales, ...noWhales]
    
    // Create D3 nodes (Hub + Whales)
    const nodes: any[] = [
      // Hub node
      {
        id: 'hub',
        x: hubPosition.x + 125, // Center of hub (size=250px)
        y: hubPosition.y + 125,
        vx: 0,
        vy: 0,
        fx: null, // Fixed position (null = free to move)
        fy: null,
        type: 'hub',
        radius: 125
      },
      // Whale nodes
      ...currentWhales.map(whale => {
        const pos = whalePositions.get(whale.id) || { x: 0, y: 0 }
        return {
          id: whale.id,
          x: pos.x + whale.size / 2, // Center of whale
          y: pos.y + whale.size / 2,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
          type: 'whale',
          whale, // Store whale data
          radius: whale.size / 2
        }
      })
    ]
    
    // Create D3 links (Hub → Whales)
    const links = currentWhales.map(whale => ({
      source: 'hub',
      target: whale.id,
      distance: (() => {
        // Distance based on tier!
        const tierConfig = TIER_CONFIGS.find(t => t.name === whale.tier) || TIER_CONFIGS[2]
        return (tierConfig.radiusMin + tierConfig.radiusMax) / 2
      })()
    }))
    
    console.log(`📊 D3 Setup: ${nodes.length} nodes, ${links.length} links`)
    
    // Create D3 Force Simulation
    const simulation = d3.forceSimulation(nodes)
      // Link force (Hub ↔ Whales) - WEAK spring (node stays where you drop!)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance((d: any) => d.distance) // Tier-based distance!
        .strength(0.05) // WEAK! (0.05 = node stays where dropped!)
      )
      // Collision force - Prevent overlapping!
      .force('collision', d3.forceCollide()
        .radius((d: any) => d.radius + 10) // Bubble radius + padding
        .strength(0.7) // Strong collision avoidance
      )
      // Many-body force (charge) - WEAK repulsion!
      .force('charge', d3.forceManyBody()
        .strength(-30) // WEAK! (was -100, now -30)
        .distanceMax(500) // Max distance for force
      )
      // NO CENTER FORCE - nodes stay where you drop them!
      // (removed d3.forceCenter)
      // Tick handler - Update React state from D3 positions!
      .on('tick', () => {
        // Update Hub position
        const hubNode = nodes.find(n => n.id === 'hub')
        if (hubNode) {
          setHubPosition({
            x: hubNode.x - 125, // Convert center to top-left
            y: hubNode.y - 125
          })
        }
        
        // Update whale positions
        setWhalePositions(prev => {
          const newPositions = new Map(prev)
          currentWhales.forEach(whale => {
            const node = nodes.find(n => n.id === whale.id)
            if (node) {
              newPositions.set(whale.id, {
                x: node.x - whale.size / 2, // Convert center to top-left
                y: node.y - whale.size / 2
              })
            }
          })
          return newPositions
        })
      })
    
    simulationRef.current = simulation
    console.log('✅ D3 Simulation started!')
    
    // Cleanup
    return () => {
      console.log('🛑 Stopping D3 simulation')
      simulation.stop()
      simulationRef.current = null
    }
  }, [positionsInitialized, loading, yesWhales, noWhales, hubPosition, whalePositions])

  // TOP 5 whales for subtle mesh network (must be before early returns!)
  const allWhales = useMemo(() => [...yesWhales, ...noWhales], [yesWhales, noWhales])
  const topYesWhales = useMemo(() => 
    [...yesWhales].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [yesWhales]
  )
  const topNoWhales = useMemo(() => 
    [...noWhales].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [noWhales]
  )

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <span className="ml-3 text-sm text-muted-foreground font-mono">Loading whales...</span>
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

  const totalWhales = yesWhales.length + noWhales.length
  const volumeText = marketInfo?.volume 
    ? marketInfo.volume > 1000000 
      ? `$${(marketInfo.volume / 1000000).toFixed(2)}M`
      : `$${(marketInfo.volume / 1000).toFixed(0)}K`
    : '$0'

  return (
    <div className="fixed inset-0 bg-black overflow-visible">
      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={3}
        limitToBounds={false} // ✅ INFINITE CANVAS (як Arkham!)
        centerOnInit={true}
        wheel={{ step: 0.1 }}
        panning={{ 
          disabled: false, // ✅ ENABLE canvas panning!
          velocityDisabled: false, // ✅ Smooth momentum!
          excluded: ['drag-node'] // Don't pan when dragging nodes!
        }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Zoom Controls (Top Right) */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
              <button
                onClick={() => zoomIn()}
                className="p-3 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 hover:border-purple-400 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-purple-400" />
              </button>
              <button
                onClick={() => zoomOut()}
                className="p-3 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 hover:border-purple-400 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-purple-400" />
              </button>
              <button
                onClick={() => resetTransform()}
                className="p-3 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 hover:border-purple-400 transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-5 h-5 text-purple-400" />
              </button>
            </div>

            {/* Floating Stats (Bottom Left) */}
            <div className="fixed bottom-4 left-4 z-40 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 px-4 py-2">
              <div className="text-xs font-mono text-muted-foreground">
                <span className="text-green-400 font-bold">{yesWhales.length}</span> YES •{' '}
                <span className="text-red-400 font-bold">{noWhales.length}</span> NO •{' '}
                <span className="text-purple-400 font-bold">{totalWhales}</span> total
              </div>
            </div>

            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: '100%',
              }}
              contentStyle={{
                width: '100%',
                height: '100%',
              }}
            >

      {/* SVG Overlay for Connection Lines - BEHIND bubbles! */}
      <svg 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'visible'
        }}
      >
        {/* Real-time fluid lines - NO TRANSITION LAG! ⚡ */}
        <style>
          {`
            path {
              /* NO TRANSITION = Real-time response! ⚡ */
            }
          `}
        </style>
        
        {/* Hub-Spoke Lines: VELOCITY-BASED CURVED lines! 🌊 */}
        {hubPosition.x !== 0 && allWhales.map((whale) => {
          const whalePos = whalePositions.get(whale.id)
          if (!whalePos) return null
          
          // Convert Draggable coordinates to SVG center coordinates
          const hubCenterX = hubPosition.x + 125 // Hub size = 250px, center = 125px
          const hubCenterY = hubPosition.y + 125
          const whaleCenterX = whalePos.x + whale.size / 2
          const whaleCenterY = whalePos.y + whale.size / 2
          
          // Get velocity (for fluid curve!) 🪢
          const velocity = whaleVelocities.get(whale.id) || { vx: 0, vy: 0 }
          const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy)
          
          // Calculate control point for quadratic Bezier curve
          const midX = (hubCenterX + whaleCenterX) / 2
          const midY = (hubCenterY + whaleCenterY) / 2
          
          // Perpendicular offset for curve
          const dx = whaleCenterX - hubCenterX
          const dy = whaleCenterY - hubCenterY
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // VELOCITY-BASED CURVATURE! 🌊
          // speed = 0 → curvature = 0 (прямі лінії!)
          // speed > 0 → curvature grows (curved як віровок!)
          const baseCurvature = Math.min(speed * 0.02, distance * 0.3) // Cap at 30% distance
          const curvature = baseCurvature
          
          // Control point perpendicular to line
          const controlX = midX + (-dy / distance) * curvature
          const controlY = midY + (dx / distance) * curvature
          
          return (
            <path
              key={`hub-${whale.id}`}
              d={`M ${hubCenterX} ${hubCenterY} Q ${controlX} ${controlY} ${whaleCenterX} ${whaleCenterY}`}
              stroke={whale.side === 'YES' ? '#10b981' : '#dc2626'}
              strokeWidth="2"
              opacity="0.6"
              fill="none"
            />
          )
        })}
        
        {/* TOP 5 MESH: Subtle CURVED connections between biggest whales */}
        {topYesWhales.length > 1 && topYesWhales.map((whale1, i) => 
          topYesWhales.slice(i + 1).map((whale2) => {
            const pos1 = whalePositions.get(whale1.id)
            const pos2 = whalePositions.get(whale2.id)
            if (!pos1 || !pos2) return null
            
            const x1 = pos1.x + whale1.size / 2
            const y1 = pos1.y + whale1.size / 2
            const x2 = pos2.x + whale2.size / 2
            const y2 = pos2.y + whale2.size / 2
            
            // Velocity-based curvature for mesh! 🌊
            const vel1 = whaleVelocities.get(whale1.id) || { vx: 0, vy: 0 }
            const vel2 = whaleVelocities.get(whale2.id) || { vx: 0, vy: 0 }
            const speed1 = Math.sqrt(vel1.vx * vel1.vx + vel1.vy * vel1.vy)
            const speed2 = Math.sqrt(vel2.vx * vel2.vx + vel2.vy * vel2.vy)
            const avgSpeed = (speed1 + speed2) / 2
            
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const dx = x2 - x1
            const dy = y2 - y1
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            const baseCurvature = Math.min(avgSpeed * 0.01, distance * 0.2)
            const curvature = baseCurvature
            
            const controlX = midX + (-dy / distance) * curvature
            const controlY = midY + (dx / distance) * curvature
            
            return (
              <path
                key={`top-yes-${whale1.id}-${whale2.id}`}
                d={`M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`}
                stroke="#10b981"
                strokeWidth="1"
                opacity="0.1"
                fill="none"
              />
            )
          })
        )}
        
        {topNoWhales.length > 1 && topNoWhales.map((whale1, i) => 
          topNoWhales.slice(i + 1).map((whale2) => {
            const pos1 = whalePositions.get(whale1.id)
            const pos2 = whalePositions.get(whale2.id)
            if (!pos1 || !pos2) return null
            
            const x1 = pos1.x + whale1.size / 2
            const y1 = pos1.y + whale1.size / 2
            const x2 = pos2.x + whale2.size / 2
            const y2 = pos2.y + whale2.size / 2
            
            // Velocity-based curvature for mesh! 🌊
            const vel1 = whaleVelocities.get(whale1.id) || { vx: 0, vy: 0 }
            const vel2 = whaleVelocities.get(whale2.id) || { vx: 0, vy: 0 }
            const speed1 = Math.sqrt(vel1.vx * vel1.vx + vel1.vy * vel1.vy)
            const speed2 = Math.sqrt(vel2.vx * vel2.vx + vel2.vy * vel2.vy)
            const avgSpeed = (speed1 + speed2) / 2
            
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const dx = x2 - x1
            const dy = y2 - y1
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            const baseCurvature = Math.min(avgSpeed * 0.01, distance * 0.2)
            const curvature = baseCurvature
            
            const controlX = midX + (-dy / distance) * curvature
            const controlY = midY + (dx / distance) * curvature
            
            return (
              <path
                key={`top-no-${whale1.id}-${whale2.id}`}
                d={`M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`}
                stroke="#dc2626"
                strokeWidth="1"
                opacity="0.1"
                fill="none"
              />
            )
          })
        )}

        {/* HOVER MESH: Show connections to same TIER + SIDE whales! */}
        {hoveredWhaleId && (() => {
          const hoveredWhale = allWhales.find(w => w.id === hoveredWhaleId)
          const hoveredPos = whalePositions.get(hoveredWhaleId)
          if (!hoveredWhale || !hoveredPos) return null
          
          const hoveredX = hoveredPos.x + hoveredWhale.size / 2
          const hoveredY = hoveredPos.y + hoveredWhale.size / 2
          
          // Find whales with SAME TIER + SAME SIDE!
          const sameTierAndSideWhales = allWhales.filter(w => 
            w.tier === hoveredWhale.tier && 
            w.side === hoveredWhale.side && 
            w.id !== hoveredWhale.id
          )
          
          return sameTierAndSideWhales.map(whale => {
            const whalePos = whalePositions.get(whale.id)
            if (!whalePos) return null
            
            const whaleX = whalePos.x + whale.size / 2
            const whaleY = whalePos.y + whale.size / 2
            
            // Velocity-based curvature for hover mesh! 🌊
            const hoveredVel = whaleVelocities.get(hoveredWhale.id) || { vx: 0, vy: 0 }
            const whaleVel = whaleVelocities.get(whale.id) || { vx: 0, vy: 0 }
            const hoveredSpeed = Math.sqrt(hoveredVel.vx * hoveredVel.vx + hoveredVel.vy * hoveredVel.vy)
            const whaleSpeed = Math.sqrt(whaleVel.vx * whaleVel.vx + whaleVel.vy * whaleVel.vy)
            const avgSpeed = (hoveredSpeed + whaleSpeed) / 2
            
            const midX = (hoveredX + whaleX) / 2
            const midY = (hoveredY + whaleY) / 2
            const dx = whaleX - hoveredX
            const dy = whaleY - hoveredY
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            const baseCurvature = Math.min(avgSpeed * 0.015, distance * 0.25)
            const curvature = baseCurvature
            
            const controlX = midX + (-dy / distance) * curvature
            const controlY = midY + (dx / distance) * curvature
            
            return (
              <path
                key={`hover-${hoveredWhale.id}-${whale.id}`}
                d={`M ${hoveredX} ${hoveredY} Q ${controlX} ${controlY} ${whaleX} ${whaleY}`}
                stroke={hoveredWhale.side === 'YES' ? '#10b981' : '#dc2626'}
                strokeWidth="2"
                opacity="0.6"
                fill="none"
              />
            )
          })
        })()}
      </svg>

      {/* Network Container - ABOVE SVG lines! */}
      <div className="relative" style={{ width: '100%', height: '100%', zIndex: 10 }}>
        {/* MARKET HUB - Center (controlled position for group drag!) */}
        <Draggable 
          position={positionsInitialized ? hubPosition : { x: 0, y: 0 }}
          onDrag={(e, data) => positionsInitialized && handleHubDrag(data)}
          onStop={() => {
            // Release hub node & cool simulation (D3 force-based! 🔥)
            if (simulationRef.current) {
              const hubNode = simulationRef.current.nodes().find((n: any) => n.id === 'hub')
              if (hubNode) {
                hubNode.fx = null
                hubNode.fy = null
              }
              simulationRef.current.alphaTarget(0) // Cool simulation
            }
          }}
        >
          <div 
            ref={hubRef}
            className="absolute cursor-move group drag-node"
            style={{ width: '250px', height: '250px' }}
          >
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 hover:border-purple-300 transition-all hover:scale-105"
              style={{
                background: 'rgba(0, 0, 0, 0.95)',
                borderColor: '#a855f7',
                boxShadow: '0 0 40px rgba(168,85,247,0.8)'
              }}
            >
              {/* Market Image - Large & Prominent! */}
              {marketInfo?.image ? (
                <img 
                  src={marketInfo.image} 
                  alt="Market" 
                  className="w-24 h-24 rounded-full mb-3 object-cover ring-4 ring-purple-500/50"
                />
              ) : (
                <div className="w-24 h-24 rounded-full mb-3 bg-purple-900 flex items-center justify-center ring-4 ring-purple-500/50">
                  <span className="text-5xl">🎯</span>
                </div>
              )}
              
              {/* Market Title */}
              <div className="text-purple-200 text-[11px] mb-2 px-6 line-clamp-2 text-center leading-tight">
                {marketInfo?.title || 'Market'}
              </div>
              
              {/* Volume - Big & Bold! */}
              <div className="text-green-400 text-3xl font-black mb-1">{volumeText}</div>
              <div className="text-purple-300 text-[9px] font-medium uppercase tracking-wider">Total Volume</div>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl -z-10 group-hover:bg-purple-400/30 transition-all"></div>
          </div>
        </Draggable>

        {/* ALL WHALES - Tier-based circular layout with GROUP DRAG! */}
        <div className="relative" style={{ width: '100%', height: '100%' }}>
          {allWhales.map((whale) => {
            // Get position from state (controlled position for group drag!)
            const position = whalePositions.get(whale.id) || { x: 0, y: 0 }

            return (
              <Draggable 
                key={whale.id}
                position={positionsInitialized ? position : { x: 0, y: 0 }}
                onDrag={(e, data) => positionsInitialized && handleWhaleDrag(whale, data)}
                onStop={() => {
                  // Reset velocity when drag stops (лінії стають прямі!)
                  setWhaleVelocities(prev => {
                    const newVelocities = new Map(prev)
                    newVelocities.set(whale.id, { vx: 0, vy: 0 })
                    return newVelocities
                  })
                  // Reset drag state (hover can work again!)
                  setIsDragging(false)
                  
                  // Release whale node & cool simulation (D3 force-based! 🔥)
                  if (simulationRef.current) {
                    const node = simulationRef.current.nodes().find((n: any) => n.id === whale.id)
                    if (node) {
                      node.fx = null
                      node.fy = null
                    }
                    simulationRef.current.alphaTarget(0) // Cool simulation
                  }
                }}
              >
                <div 
                  ref={(el) => {
                    if (el) whaleRefs.current.set(whale.id, el)
                  }}
                  className="absolute cursor-move group drag-node"
                  style={{ 
                    width: `${whale.size}px`, 
                    height: `${whale.size}px`
                  }}
                  onMouseEnter={() => setHoveredWhaleId(whale.id)}
                  onMouseLeave={() => {
                    // Don't clear hover if dragging! (лінії не пропадають!)
                    if (!isDragging) {
                      setHoveredWhaleId(null)
                    }
                  }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full flex items-center justify-center shadow-lg hover:border-white cursor-pointer"
                    style={{
                      background: 'rgba(0, 0, 0, 0.85)',
                      borderColor: whale.color,
                      borderWidth: whale.tier === 'S' ? '4px' : whale.tier === 'A' ? '3px' : '2px',
                      borderStyle: 'solid',
                      boxShadow: `0 0 ${whale.tier === 'S' ? '30' : whale.tier === 'A' ? '20' : '15'}px ${whale.color}${whale.tier === 'S' ? 'CC' : '80'}`
                    }}
                    whileHover={{ scale: 1.1, borderColor: '#ffffff' }}
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 20
                    }}
                    onDoubleClick={() => window.open(`https://polymarket.com/profile/${whale.wallet}`, '_blank')}
                  >
                    {/* TIER BADGE - Top Right Corner */}
                    <div 
                      className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg"
                      style={{
                        background: whale.tier === 'S' ? '#fbbf24' : whale.tier === 'A' ? '#a78bfa' : '#60a5fa',
                        color: '#000',
                        border: '2px solid rgba(0,0,0,0.8)',
                        boxShadow: `0 0 10px ${whale.tier === 'S' ? '#fbbf24' : whale.tier === 'A' ? '#a78bfa' : '#60a5fa'}80`
                      }}
                    >
                      {whale.tier}
                    </div>
                    
                    <div className="text-center text-white text-xs font-bold">
                      <div className="text-[10px] opacity-80">
                        {whale.wallet.slice(0, 4)}...{whale.wallet.slice(-4)}
                      </div>
                      <div className="text-sm">
                        ${(whale.amount / 1000).toFixed(1)}K
                      </div>
                    </div>
                  </motion.div>
                  {/* Glow */}
                  <div 
                    className="absolute inset-0 rounded-full blur-md -z-10 opacity-50 group-hover:opacity-75 transition-opacity"
                    style={{ backgroundColor: whale.color }}
                  ></div>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div 
                      className="bg-black/90 pixel-border px-3 py-2 text-xs font-mono whitespace-nowrap"
                      style={{ borderColor: `${whale.color}40` }}
                    >
                      <div className="font-bold mb-1" style={{ color: whale.color }}>
                        {whale.side} WHALE
                      </div>
                      <div className="text-white">{whale.wallet.slice(0, 8)}...{whale.wallet.slice(-6)}</div>
                      <div className="font-bold" style={{ color: whale.color }}>
                        ${whale.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </Draggable>
            )
          })}
        </div>
      </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
