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
  market_id: string
  market_title: string
  outcome: string
  size: number
  unrealized_pnl: number
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
        const pnl = pos.unrealized_pnl || 0
        const bubble: PositionBubble = {
          id: `pos-${idx}`,
          title: pos.market_title,
          outcome: pos.outcome,
          pnl,
          size: Math.min(Math.max(Math.abs(pnl) / 10, 30), 80),
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
    const nodes = allPositions.map(pos => ({
      id: pos.id,
      x: Math.random() * 800 + 200,
      y: Math.random() * 600 + 100,
      side: pos.pnl >= 0 ? 'profit' : 'loss'
    }))

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-100))
      .force('collision', d3.forceCollide().radius(60))
      .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
      .alphaDecay(0.02)
      .velocityDecay(0.3)

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
          {/* Trader Hub (Center) */}
          <Draggable
            position={hubPosition}
            onDrag={handleHubDrag}
            nodeRef={hubRef}
          >
            <div
              ref={hubRef}
              className="absolute cursor-move"
              style={{
                left: `calc(50vw - 60px)`,
                top: `calc(50vh - 60px)`,
                transform: `translate(${hubPosition.x}px, ${hubPosition.y}px)`,
                willChange: 'transform'
              }}
            >
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                {/* Hub Circle */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 border-4 border-green-400 shadow-2xl shadow-green-500/50 flex items-center justify-center overflow-hidden">
                  {trader?.avatar && (
                    <img
                      src={trader.avatar}
                      alt={trader.displayName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
                      }}
                    />
                  )}
                </div>

                {/* Trader Name */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <p className="text-white font-bold text-lg text-center drop-shadow-lg">
                    {trader?.displayName || 'Trader'}
                  </p>
                </div>
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
                position={pos}
                onDrag={handlePositionDrag(position.id)}
              >
                <motion.div
                  className="absolute cursor-move"
                  style={{
                    willChange: 'transform',
                    zIndex: isHovered ? 1000 : 1
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: idx * 0.05
                  }}
                  onMouseEnter={() => setHoveredPositionId(position.id)}
                  onMouseLeave={() => setHoveredPositionId(null)}
                >
                  {/* Bubble */}
                  <div
                    className="rounded-full border-4 shadow-2xl flex items-center justify-center transition-all"
                    style={{
                      width: position.size,
                      height: position.size,
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
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(0)}
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
              </Draggable>
            )
          })}

          {/* SVG Lines (Hub to Positions) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          >
            {allPositions.map(position => {
              const pos = positionPositions.get(position.id)
              if (!pos) return null

              const hubX = window.innerWidth / 2 + hubPosition.x
              const hubY = window.innerHeight / 2 + hubPosition.y

              return (
                <line
                  key={`line-${position.id}`}
                  x1={hubX}
                  y1={hubY}
                  x2={pos.x + position.size / 2}
                  y2={pos.y + position.size / 2}
                  stroke={position.color}
                  strokeWidth={2}
                  strokeOpacity={0.3}
                />
              )
            })}
          </svg>
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
