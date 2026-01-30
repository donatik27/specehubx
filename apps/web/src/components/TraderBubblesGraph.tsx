'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import Draggable, { DraggableData } from 'react-draggable'
import { motion } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import * as d3 from 'd3-force'
import { useRouter } from 'next/navigation'

interface Trader {
  address: string
  displayName: string
  avatar: string
  estimatedPnL: number
  tier: string
}

interface Position {
  title: string
  outcome: string
  size: number
  cashPnl: number // unrealized P&L
  currentValue: number
  initialValue: number
  redeemable: boolean
}

interface PositionBubble {
  id: string
  title: string
  outcome: string
  pnl: number
  size: number
  color: string
  x: number
  y: number
}

interface TraderHub {
  x: number
  y: number
}

interface TraderBubblesGraphProps {
  address: string
}

export default function TraderBubblesGraph({ address }: TraderBubblesGraphProps) {
  const router = useRouter()
  const [trader, setTrader] = useState<Trader | null>(null)
  const [profitablePositions, setProfitablePositions] = useState<PositionBubble[]>([])
  const [losingPositions, setLosingPositions] = useState<PositionBubble[]>([])
  const [traderHub, setTraderHub] = useState<TraderHub>({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredPositionId, setHoveredPositionId] = useState<string | null>(null)
  
  const [positionPositions, setPositionPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [hubPosition, setHubPosition] = useState({ x: 0, y: 0 })
  const [positionsInitialized, setPositionsInitialized] = useState(false)
  
  // Velocity tracking for fluid lines (як віровок! 🪢)
  const [positionVelocities, setPositionVelocities] = useState<Map<string, { vx: number; vy: number }>>(new Map())
  const lastPositionsRef = useRef<Map<string, { x: number; y: number; timestamp: number }>>(new Map())
  
  const hubRef = useRef<HTMLDivElement>(null)
  const positionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)

  const fetchPositionBubbles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch trader info
      console.log(`🔍 Fetching trader: ${address}`)
      const traderRes = await fetch(`/api/trader/${address}`)
      if (traderRes.ok) {
        const traderData = await traderRes.json()
        setTrader(traderData)
        console.log(`👤 Trader: ${traderData.displayName}`)
      }

      // Fetch open positions via proxy endpoint
      console.log(`🔍 Fetching open positions via proxy for: ${address}`)
      const positionsRes = await fetch(
        `/api/trader-positions?address=${address}`
      )
      
      console.log(`📡 Proxy response status: ${positionsRes.status}`)

      if (!positionsRes.ok) {
        throw new Error('Failed to fetch positions')
      }

      const positionsResponse = await positionsRes.json()
      const positionsData: Position[] = positionsResponse.positions || []
      console.log(`📊 Fetched ${positionsData.length} open positions!`)

      if (positionsData.length === 0) {
        setError('No open positions')
        setLoading(false)
        return
      }

      // Split into profitable vs losing
      // FILTER: Keep ALL profitable, only LARGE losing positions (for good profile look!)
      const profitable: PositionBubble[] = []
      const losing: PositionBubble[] = []

      positionsData.forEach((pos, idx) => {
        const pnl = pos.cashPnl || 0
        
        // Skip small losing positions (< -500) - play in trader's favor! 💚
        if (pnl < 0 && Math.abs(pnl) < 500) {
          console.log(`⏭️ Skipping small loss: $${pnl.toFixed(0)} - ${pos.title.substring(0, 30)}`)
          return
        }
        
        const bubble: PositionBubble = {
          id: `pos-${idx}`,
          title: pos.title,
          outcome: pos.outcome,
          pnl,
          size: Math.min(Math.max(Math.abs(pnl) / 30, 60), 150), // BIGGER bubbles! 🫧
          color: pnl >= 0 ? '#22c55e' : '#ef4444',
          x: 0,
          y: 0
        }

        if (pnl >= 0) {
          profitable.push(bubble)
        } else {
          losing.push(bubble)
        }
      })

      setProfitablePositions(profitable)
      setLosingPositions(losing)

      console.log(`🟢 Profitable: ${profitable.length}`)
      console.log(`🔴 Losing: ${losing.length}`)

      setLoading(false)
    } catch (err) {
      console.error('❌ Error fetching positions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load positions')
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchPositionBubbles()
  }, [fetchPositionBubbles])

  // Initialize D3 Force Simulation - ARKHAM STYLE! 🔥
  useEffect(() => {
    if (loading || error || (!profitablePositions.length && !losingPositions.length)) return

    const allPositions = [...profitablePositions, ...losingPositions]
    
    // D3 Force Simulation nodes
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    
    const nodes = allPositions.map((pos, idx) => {
      // Radial placement around hub (evenly distributed!)
      const angle = (idx / allPositions.length) * Math.PI * 2
      const radius = 250 + Math.random() * 100 // 250-350px from center
      
      return {
        id: pos.id,
        type: 'position',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        fx: null, // Not fixed initially
        fy: null,
        side: pos.pnl >= 0 ? 'profit' : 'loss'
      }
    })

    // Hub node (virtual, for links)
    const hubNode = {
      id: 'hub',
      type: 'hub',
      x: centerX,
      y: centerY,
      fx: centerX, // Hub is always fixed in center
      fy: centerY
    }

    // All nodes (hub + positions)
    const allNodes = [hubNode, ...nodes]

    // Links: Hub to each position
    const links = nodes.map(node => ({
      source: 'hub',
      target: node.id,
      type: 'hub-position'
    }))

    // Create simulation with forces - LIKE ARKHAM! 🎯
    const simulation = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(links)
        .id((d: any) => d.id)
        .distance(300) // Distance from hub to bubbles
        .strength(0.3) // Medium strength - bubbles orbit hub!
      )
      .force('charge', d3.forceManyBody()
        .strength(-100) // Repulsion between bubbles
      )
      .force('collision', d3.forceCollide()
        .radius(80) // Prevent overlap (bigger bubbles need more space!)
        .strength(0.8)
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .alphaDecay(0.015) // Slower cooldown = longer animation
      .velocityDecay(0.3) // Less friction = more fluid!

    simulationRef.current = simulation

    // Update positions on tick
    simulation.on('tick', () => {
      const newPositions = new Map<string, { x: number; y: number }>()
      
      nodes.forEach(node => {
        // Convert from center coords to top-left coords (for Draggable)
        const position = allPositions.find(p => p.id === node.id)
        if (position) {
          const x = (node.x || centerX) - position.size / 2
          const y = (node.y || centerY) - position.size / 2
          newPositions.set(node.id, { x, y })
        }
      })
      
      setPositionPositions(newPositions)
      if (!positionsInitialized) {
        setPositionsInitialized(true)
      }
    })

    return () => {
      simulation.stop()
    }
  }, [loading, error, profitablePositions, losingPositions, positionsInitialized])

  // Handle hub drag - ALL BUBBLES FOLLOW! 🧲
  const handleHubDrag = useCallback((_e: any, data: DraggableData) => {
    if (!simulationRef.current) return
    
    // Convert Draggable coords to center coords
    const newHubCenterX = window.innerWidth / 2 + data.x
    const newHubCenterY = window.innerHeight / 2 + data.y
    
    const oldHubCenterX = window.innerWidth / 2 + hubPosition.x
    const oldHubCenterY = window.innerHeight / 2 + hubPosition.y
    
    const dx = newHubCenterX - oldHubCenterX
    const dy = newHubCenterY - oldHubCenterY
    
    // Move hub
    setHubPosition({ x: data.x, y: data.y })
    
    // Move hub node in D3
    const hubNode = simulationRef.current.nodes().find((n: any) => n.type === 'hub')
    if (hubNode) {
      hubNode.fx = newHubCenterX
      hubNode.fy = newHubCenterY
      hubNode.x = newHubCenterX
      hubNode.y = newHubCenterY
    }
    
    // Move ALL position bubbles together! (group drag!)
    simulationRef.current.nodes().forEach((node: any) => {
      if (node.type === 'position') {
        if (node.fx !== null && node.fy !== null) {
          node.fx += dx
          node.fy += dy
        }
        if (node.x !== undefined && node.y !== undefined) {
          node.x += dx
          node.y += dy
        }
      }
    })
    
    // Update position map (Draggable coords)
    setPositionPositions(prev => {
      const updated = new Map(prev)
      prev.forEach((pos, id) => {
        updated.set(id, { x: pos.x + dx, y: pos.y + dy })
      })
      return updated
    })
    
    // Reheat simulation for smooth movement! 🔥
    simulationRef.current.alpha(0.2).restart()
  }, [hubPosition])

  // Handle position drag - WITH VELOCITY TRACKING! 🌊
  const handlePositionDrag = useCallback((position: PositionBubble) => (_e: any, data: DraggableData) => {
    if (!simulationRef.current) return
    
    // Find node in D3 simulation
    const node = simulationRef.current.nodes().find((n: any) => n.id === position.id && n.type === 'position')
    if (!node) return
    
    // Convert Draggable coords (top-left) to D3 coords (center)
    const centerX = data.x + position.size / 2
    const centerY = data.y + position.size / 2
    
    // Calculate velocity for fluid lines! 🌊
    const now = Date.now()
    const lastPos = lastPositionsRef.current.get(position.id)
    if (lastPos) {
      const dt = (now - lastPos.timestamp) / 1000 // seconds
      if (dt > 0 && dt < 1) { // Ignore huge gaps
        const vx = (centerX - lastPos.x) / dt
        const vy = (centerY - lastPos.y) / dt
        
        setPositionVelocities(prev => {
          const newVelocities = new Map(prev)
          newVelocities.set(position.id, { vx, vy })
          return newVelocities
        })
      }
    }
    
    // Save current position for next velocity calc
    lastPositionsRef.current.set(position.id, { x: centerX, y: centerY, timestamp: now })
    
    // Fix THIS bubble in place during drag
    node.fx = centerX
    node.fy = centerY
    node.x = centerX
    node.y = centerY
    
    // Update position map (top-left coords for Draggable)
    setPositionPositions(prev => {
      const updated = new Map(prev)
      updated.set(position.id, { x: data.x, y: data.y })
      return updated
    })
    
    // Reheat simulation - others will follow softly through links! 🔥
    simulationRef.current.alpha(0.3).restart()
  }, [])

  // Handle drag end - release fixed position
  const handleDragStop = useCallback((positionId: string) => () => {
    if (!simulationRef.current) return
    
    const node = simulationRef.current.nodes().find((n: any) => n.id === positionId)
    if (node) {
      node.fx = null // Release! Let physics take over!
      node.fy = null
    }
    
    // Clear velocity after a delay
    setTimeout(() => {
      setPositionVelocities(prev => {
        const updated = new Map(prev)
        updated.delete(positionId)
        return updated
      })
    }, 500)
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading position bubbles...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-6xl mb-4">🫧</p>
          <p className="text-xl text-white mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">
            This trader has no active positions at the moment
          </p>
        </div>
      </div>
    )
  }

  const allPositions = [...profitablePositions, ...losingPositions]

  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.1}
      maxScale={3}
      centerOnInit
      wheel={{ step: 0.1 }}
      panning={{ 
        disabled: false,
        excluded: ['draggable-element'] // Exclude draggable elements from panning!
      }}
    >
      <TransformComponent
        wrapperStyle={{
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          cursor: 'grab'
        }}
        contentStyle={{
          width: '100%',
          height: '100%'
        }}
      >
        <div
          style={{
            width: '100vw',
            height: '100vh',
            position: 'relative'
          }}
        >
          {/* Trader Hub (Center) - ON TOP of lines! */}
          <Draggable
            position={hubPosition}
            onDrag={handleHubDrag}
            nodeRef={hubRef}
          >
            <div
              ref={hubRef}
              className="absolute cursor-move draggable-element"
              style={{
                left: `calc(50vw - 64px)`, // Center hub (128px / 2)
                top: `calc(50vh - 64px)`,
                width: '128px',
                height: '128px',
                zIndex: 100, // Above everything!
                willChange: 'transform'
              }}
            >
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                {/* Hub Circle - Like WhaleNetworkGraph! */}
                <div 
                  className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 transition-all hover:scale-105 hover:border-green-300"
                  style={{
                    background: 'rgba(0, 0, 0, 0.95)',
                    borderColor: '#22c55e',
                    boxShadow: '0 0 40px rgba(34, 197, 94, 0.8)'
                  }}
                >
                  {/* Trader Avatar */}
                  {trader?.avatar ? (
                    <img
                      src={trader.avatar}
                      alt={trader.displayName}
                      className="w-16 h-16 rounded-full mb-2 object-cover ring-4 ring-green-500/50"
                      onError={(e) => {
                        e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full mb-2 bg-green-900 flex items-center justify-center ring-4 ring-green-500/50">
                      <span className="text-4xl">🎯</span>
                    </div>
                  )}

                  {/* Trader Name */}
                  <div className="text-green-200 text-[10px] px-3 text-center leading-tight">
                    {trader?.displayName || 'Trader'}
                  </div>
                </div>

                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl -z-10"></div>
              </motion.div>
            </div>
          </Draggable>

          {/* Position Bubbles */}
          {allPositions.map((position, idx) => {
            const pos = positionPositions.get(position.id) || { x: 0, y: 0 }
            const isHovered = hoveredPositionId === position.id

            return (
              <Draggable
                key={position.id}
                position={positionsInitialized ? pos : { x: 0, y: 0 }}
                onDrag={handlePositionDrag(position)}
                onStop={handleDragStop(position.id)}
              >
                <div 
                  className="absolute cursor-move draggable-element"
                  style={{ 
                    width: `${position.size}px`, 
                    height: `${position.size}px`,
                    zIndex: isHovered ? 1000 : 10 // Above lines, below hub
                  }}
                  onMouseEnter={() => setHoveredPositionId(position.id)}
                  onMouseLeave={() => setHoveredPositionId(null)}
                >
                  <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                      delay: idx * 0.05
                    }}
                  >
                    {/* Bubble */}
                    <div
                      className="absolute inset-0 rounded-full border-4 shadow-2xl flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: position.color,
                        borderColor: position.pnl >= 0 ? '#86efac' : '#fca5a5',
                        boxShadow: isHovered 
                          ? `0 0 40px ${position.color}`
                          : `0 0 20px ${position.color}80`,
                        transform: isHovered ? 'scale(1.2)' : 'scale(1)'
                      }}
                    >
                      {/* PnL Label */}
                      <p className="text-white font-bold text-xs drop-shadow-lg">
                        {position.pnl >= 0 ? '+' : ''}${Math.abs(position.pnl).toFixed(0)}
                      </p>
                    </div>

                    {/* Hover Tooltip */}
                    {isHovered && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-black/90 backdrop-blur-sm pixel-border border-white/30 p-3 whitespace-nowrap z-50 shadow-xl">
                        <p className="text-white font-bold text-sm mb-1">
                          {position.title.substring(0, 50)}...
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Outcome: <span className="text-white">{position.outcome}</span>
                        </p>
                        <p className={`text-xs mt-1 font-bold ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          Unrealized P&L: {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </Draggable>
            )
          })}

          {/* SVG Lines (Hub to Positions) - STRAIGHT lines like Arkham! 🎯 */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ 
              width: '100%', 
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 0
            }}
          >
            {allPositions.map(position => {
              const pos = positionPositions.get(position.id)
              if (!pos || !positionsInitialized) return null

              // Hub center (avatar in middle of 128px hub)
              const hubX = window.innerWidth / 2 + hubPosition.x
              const hubY = window.innerHeight / 2 + hubPosition.y

              // Bubble center (Draggable uses top-left, so add half size)
              const bubbleX = pos.x + position.size / 2
              const bubbleY = pos.y + position.size / 2

              // Get velocity for fluid effect! 🌊
              const velocity = positionVelocities.get(position.id)
              const speed = velocity ? Math.sqrt(velocity.vx ** 2 + velocity.vy ** 2) : 0
              const velocityOpacity = Math.min(0.7, 0.25 + speed * 0.0005) // Fluid boost when moving!

              // Calculate line length for gradient effect
              const dx = bubbleX - hubX
              const dy = bubbleY - hubY
              const distance = Math.sqrt(dx * dx + dy * dy)

              return (
                <g key={`line-${position.id}`}>
                  {/* Main line */}
                  <line
                    x1={hubX}
                    y1={hubY}
                    x2={bubbleX}
                    y2={bubbleY}
                    stroke={position.color}
                    strokeWidth={2.5}
                    strokeOpacity={velocityOpacity}
                    strokeLinecap="round"
                  />
                  {/* Glow effect when moving fast */}
                  {speed > 50 && (
                    <line
                      x1={hubX}
                      y1={hubY}
                      x2={bubbleX}
                      y2={bubbleY}
                      stroke={position.color}
                      strokeWidth={6}
                      strokeOpacity={Math.min(0.3, speed * 0.0003)}
                      strokeLinecap="round"
                      filter="blur(4px)"
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
