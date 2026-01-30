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
      const profitable: PositionBubble[] = []
      const losing: PositionBubble[] = []

      positionsData.forEach((pos, idx) => {
        const pnl = pos.cashPnl || 0
        const bubble: PositionBubble = {
          id: `pos-${idx}`,
          title: pos.title,
          outcome: pos.outcome,
          pnl,
          size: Math.min(Math.max(Math.abs(pnl) / 50, 30), 80), // Adjusted size calculation
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

  // Initialize D3 Force Simulation
  useEffect(() => {
    if (loading || error || (!profitablePositions.length && !losingPositions.length)) return

    const allPositions = [...profitablePositions, ...losingPositions]
    
    // D3 Force Simulation nodes
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    
    const nodes = allPositions.map((pos, idx) => {
      // Radial placement around hub
      const angle = (idx / allPositions.length) * Math.PI * 2
      const radius = 200 + Math.random() * 150
      
      return {
        id: pos.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        side: pos.pnl >= 0 ? 'profit' : 'loss'
      }
    })

    // Create simulation with radial forces
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-50)) // Less repulsion
      .force('collision', d3.forceCollide().radius(50))
      .force('radial', d3.forceRadial(250, centerX, centerY).strength(0.5)) // Keep near hub!
      .force('center', d3.forceCenter(centerX, centerY).strength(0.1))
      .alphaDecay(0.01)
      .velocityDecay(0.4)

    simulationRef.current = simulation

    // Update positions on tick
    simulation.on('tick', () => {
      const newPositions = new Map<string, { x: number; y: number }>()
      nodes.forEach(node => {
        newPositions.set(node.id, { x: node.x || 0, y: node.y || 0 })
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

  // Handle hub drag
  const handleHubDrag = (_e: any, data: DraggableData) => {
    setHubPosition({ x: data.x, y: data.y })
  }

  // Handle position drag
  const handlePositionDrag = (positionId: string) => (_e: any, data: DraggableData) => {
    setPositionPositions(prev => {
      const updated = new Map(prev)
      updated.set(positionId, { x: data.x, y: data.y })
      return updated
    })
  }

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
      >
        <div
          style={{
            width: '100vw',
            height: '100vh',
            position: 'relative'
          }}
        >
          {/* Trader Hub (Center) - Fixed in middle! */}
          <Draggable
            position={hubPosition}
            onDrag={handleHubDrag}
            nodeRef={hubRef}
          >
            <div
              ref={hubRef}
              className="absolute cursor-move"
              style={{
                left: `calc(50vw - 64px)`, // Center hub (128px / 2)
                top: `calc(50vh - 64px)`,
                width: '128px',
                height: '128px',
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
                onDrag={handlePositionDrag(position.id)}
              >
                <div 
                  className="absolute cursor-move"
                  style={{ 
                    width: `${position.size}px`, 
                    height: `${position.size}px`,
                    zIndex: isHovered ? 1000 : 1
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

          {/* SVG Lines (Hub to Positions) - Curved like WhaleNetworkGraph! */}
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

              // Hub center
              const hubX = window.innerWidth / 2 + hubPosition.x + 64
              const hubY = window.innerHeight / 2 + hubPosition.y + 64

              // Bubble center
              const bubbleX = pos.x + position.size / 2
              const bubbleY = pos.y + position.size / 2

              // Curved path (like WhaleNetworkGraph!)
              const midX = (hubX + bubbleX) / 2
              const midY = (hubY + bubbleY) / 2
              const dx = bubbleX - hubX
              const dy = bubbleY - hubY
              const distance = Math.sqrt(dx * dx + dy * dy)
              
              // Control point for curve
              const curvature = distance * 0.1
              const controlX = midX + (-dy / distance) * curvature
              const controlY = midY + (dx / distance) * curvature

              return (
                <path
                  key={`line-${position.id}`}
                  d={`M ${hubX} ${hubY} Q ${controlX} ${controlY} ${bubbleX} ${bubbleY}`}
                  stroke={position.color}
                  strokeWidth={2}
                  strokeOpacity={0.4}
                  fill="none"
                />
              )
            })}
          </svg>
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
