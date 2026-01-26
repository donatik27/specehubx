'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Home, Users, Target, Globe, Bell, Activity, TrendingUp } from 'lucide-react'

interface SiteNode {
  id: string
  title: string
  description: string
  route: string
  icon: React.ReactNode
  status: 'LIVE' | 'BETA' | 'SOON'
  position: { row: number; col: number }
  color?: string
}

const NODES: SiteNode[] = [
  {
    id: 'home',
    title: 'START',
    description: 'Your command center dashboard',
    route: '/',
    icon: <Home className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 2, col: 0 },
    color: 'from-green-500/20 to-green-500/5'
  },
  {
    id: 'traders',
    title: 'TRADERS',
    description: 'Top performers leaderboard',
    route: '/traders',
    icon: <Users className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 0, col: 2 },
    color: 'from-blue-500/20 to-blue-500/5'
  },
  {
    id: 'alpha',
    title: 'ALPHA',
    description: 'Smart money positions',
    route: '/markets/smart',
    icon: <Target className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 0, col: 3 },
    color: 'from-blue-500/20 to-blue-500/5'
  },
  {
    id: 'radar',
    title: 'RADAR',
    description: '3D trader locations',
    route: '/map',
    icon: <Globe className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 2, col: 2 },
    color: 'from-cyan-500/20 to-cyan-500/5'
  },
  {
    id: 'alerts',
    title: 'ALERTS',
    description: 'Telegram notifications',
    route: '/alerts',
    icon: <Bell className="w-4 h-4" />,
    status: 'BETA',
    position: { row: 4, col: 2 },
    color: 'from-yellow-500/20 to-yellow-500/5'
  },
  {
    id: 'markets',
    title: 'MARKETS',
    description: 'Browse all prediction markets',
    route: '/markets',
    icon: <TrendingUp className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 2, col: 4 },
    color: 'from-pink-500/20 to-pink-500/5'
  },
  {
    id: 'polymarket',
    title: 'POLYMARKET',
    description: 'Place your bets here',
    route: 'https://polymarket.com?via=01k',
    icon: <TrendingUp className="w-4 h-4" />,
    status: 'LIVE',
    position: { row: 2, col: 5 },
    color: 'from-blue-600/20 to-blue-600/5'
  }
]

const METRO_LINES = [
  {
    name: 'green',
    color: 'rgba(0,255,0,1)',
    colorDim: 'rgba(0,255,0,0.2)',
    connections: [
      { from: 'home', to: 'markets' },
      { from: 'markets', to: 'polymarket' }
    ]
  },
  {
    name: 'blue',
    color: 'rgba(59,130,246,1)',
    colorDim: 'rgba(59,130,246,0.2)',
    connections: [
      { from: 'home', to: 'traders' },
      { from: 'traders', to: 'alpha' },
      { from: 'alpha', to: 'markets' }
    ]
  },
  {
    name: 'cyan',
    color: 'rgba(6,182,212,1)',
    colorDim: 'rgba(6,182,212,0.2)',
    connections: [
      { from: 'home', to: 'radar' },
      { from: 'radar', to: 'markets' }
    ]
  },
  {
    name: 'yellow',
    color: 'rgba(234,179,8,1)',
    colorDim: 'rgba(234,179,8,0.2)',
    connections: [
      { from: 'home', to: 'alerts' },
      { from: 'alerts', to: 'polymarket' }
    ]
  }
]

export default function SiteMapNeural() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  // Get connected nodes and metro line for glow effect
  const getConnectedNodesAndLine = (nodeId: string): { nodes: string[]; line: string | null } => {
    const connected = new Set([nodeId])
    let activeLine: string | null = null
    
    METRO_LINES.forEach(line => {
      line.connections.forEach(conn => {
        if (conn.from === nodeId || conn.to === nodeId) {
          connected.add(conn.from)
          connected.add(conn.to)
          activeLine = line.name
        }
      })
    })
    
    return { nodes: Array.from(connected), line: activeLine }
  }

  const connectedInfo = hoveredNode ? getConnectedNodesAndLine(hoveredNode) : { nodes: [], line: null }
  const connectedNodes = connectedInfo.nodes
  const activeMetroLine = connectedInfo.line

  // Calculate node positions dynamically
  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return
      
      const positions: Record<string, { x: number; y: number }> = {}
      NODES.forEach(node => {
        const element = document.getElementById(`node-${node.id}`)
        if (element) {
          const rect = element.getBoundingClientRect()
          const containerRect = containerRef.current!.getBoundingClientRect()
          positions[node.id] = {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
          }
        }
      })
      setNodePositions(positions)
    }

    updatePositions()
    window.addEventListener('resize', updatePositions)
    
    // Update after render
    const timer = setTimeout(updatePositions, 100)
    
    return () => {
      window.removeEventListener('resize', updatePositions)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="mb-12 relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-2xl font-bold text-primary font-mono flex items-center gap-2">
            <span className="text-3xl animate-pulse">👽</span>
            ALIEN_NAVIGATION_SYSTEM
          </h2>
        </div>
        <p className="text-muted-foreground text-sm font-mono">
          &gt; MISSION_CONTROL // FOLLOW_YOUR_PATH_TO_SUCCESS
        </p>
      </div>

      {/* Neural Network Grid */}
      <div ref={containerRef} className="relative bg-card/30 backdrop-blur-sm rounded-lg border border-primary/20 p-8 overflow-hidden">

        {/* Background grid effect */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgb(var(--primary)) 1px, transparent 1px),
              linear-gradient(to bottom, rgb(var(--primary)) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* SVG for connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <defs>
            {/* Gradient for lines */}
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0.2" />
              <stop offset="50%" stopColor="rgb(var(--primary))" stopOpacity="0.6" />
              <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.2" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Animated gradient for particles */}
            <linearGradient id="particleGradient">
              <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0">
                <animate attributeName="offset" values="0;1" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="rgb(var(--primary))" stopOpacity="1">
                <animate attributeName="offset" values="0;1" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0">
                <animate attributeName="offset" values="0;1" dur="2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

          </defs>

          {METRO_LINES.map((line) => 
            line.connections.map((conn, i) => {
              const fromPos = nodePositions[conn.from]
              const toPos = nodePositions[conn.to]
              if (!fromPos || !toPos) return null

              const isLineActive = activeMetroLine === line.name
              const isHighlighted = hoveredNode && (
                connectedNodes.includes(conn.from) && connectedNodes.includes(conn.to)
              )

              return (
                <g key={`${line.name}-${conn.from}-${conn.to}`}>
                  {/* Connection line with dashed animation */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke={isHighlighted ? line.color : line.colorDim}
                    strokeWidth={isHighlighted ? "4" : "2"}
                    strokeDasharray={isHighlighted ? "10 5" : "5 5"}
                    className="transition-all duration-300"
                    style={{
                      filter: isHighlighted ? `url(#glow) drop-shadow(0 0 15px ${line.color}) drop-shadow(0 0 25px ${line.color})` : 'none',
                    }}
                  >
                    {isHighlighted && (
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="30"
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    )}
                  </line>
                  
                  {/* Animated particles */}
                  {isHighlighted && (
                    <>
                      <circle r="4" fill={line.color} filter="url(#glow)">
                        <animateMotion
                          dur="1.2s"
                          repeatCount="indefinite"
                          path={`M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`}
                        />
                      </circle>
                      <circle r="3" fill={line.color} filter="url(#glow)">
                        <animateMotion
                          dur="1.2s"
                          repeatCount="indefinite"
                          begin="0.4s"
                          path={`M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`}
                        />
                      </circle>
                      <circle r="3" fill={line.color} filter="url(#glow)">
                        <animateMotion
                          dur="1.2s"
                          repeatCount="indefinite"
                          begin="0.8s"
                          path={`M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`}
                        />
                      </circle>
                    </>
                  )}
                </g>
              )
            })
          )}
        </svg>

        {/* Mission Paths Legend */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🛸</span>
            <span className="text-xs font-mono text-primary">MISSION_PATHS:</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-green-500 rounded-full shadow-[0_0_8px_rgba(0,255,0,0.8)] animate-pulse" />
              <span className="text-green-400">🚀 DIRECT_PATH</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
              <span className="text-blue-400">🧠 INTEL_PATH</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
              <span className="text-cyan-400">🌍 RADAR_PATH</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse" />
              <span className="text-yellow-400">⚡ ALERT_PATH</span>
            </div>
          </div>
        </div>

        {/* Nodes Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-6 gap-6" style={{ minHeight: '400px' }}>
          {NODES.map((node) => {
            const isHighlighted = connectedNodes.includes(node.id)
            const isCenter = node.id === 'home'
            const isExternal = node.id === 'polymarket'
            
            const Component = isExternal ? 'a' : Link
            const linkProps = isExternal ? {
              href: node.route,
              target: '_blank',
              rel: 'noopener noreferrer'
            } : {
              href: node.route
            }
            
            return (
              <Component
                key={node.id}
                {...linkProps}
                id={`node-${node.id}`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={`
                  relative group
                  ${node.id === 'home' ? 'md:col-start-1' : ''}
                  ${node.id === 'traders' ? 'md:col-start-3' : ''}
                  ${node.id === 'alpha' ? 'md:col-start-4' : ''}
                  ${node.id === 'radar' ? 'md:col-start-3' : ''}
                  ${node.id === 'alerts' ? 'md:col-start-3' : ''}
                  ${node.id === 'markets' ? 'md:col-start-5' : ''}
                  ${node.id === 'polymarket' ? 'md:col-start-6' : ''}
                `}
                style={{
                  gridRow: node.position.row + 1
                }}
              >
                <div
                  className={`
                    relative overflow-hidden
                    bg-gradient-to-br ${node.color} backdrop-blur-sm
                    border-2 rounded-lg p-4
                    transition-all duration-300
                    ${isHighlighted 
                      ? 'border-primary shadow-[0_0_30px_rgba(0,255,0,0.6),0_0_60px_rgba(0,255,0,0.3)] scale-110' 
                      : 'border-primary/30 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(0,255,0,0.3)]'
                    }
                    ${isCenter ? 'ring-2 ring-primary/70 shadow-[0_0_25px_rgba(0,255,0,0.4)]' : ''}
                  `}
                >
                  {/* Scanline effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 neural-scanline" />
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon + Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className={`
                        p-1.5 rounded-md
                        ${isHighlighted 
                          ? 'bg-primary/30 text-primary shadow-[0_0_15px_rgba(0,255,0,0.6)]' 
                          : 'bg-primary/10 text-primary/70'
                        }
                        transition-all duration-300
                        group-hover:scale-125 group-hover:rotate-6
                      `}>
                        {node.icon}
                      </div>
                      
                      <div className={`
                        text-[10px] font-mono px-2 py-1 rounded-full
                        ${node.status === 'LIVE' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                          : node.status === 'BETA'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                        }
                      `}>
                        {node.status === 'LIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1" />}
                        {node.status}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`
                      text-sm font-bold font-mono mb-2 transition-colors duration-300
                      ${isHighlighted ? 'text-primary' : 'text-white group-hover:text-primary'}
                    `}>
                      {node.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                      {node.description}
                    </p>

                    {/* Arrow indicator */}
                    <div className={`
                      mt-3 flex items-center gap-1 text-xs font-mono
                      ${isHighlighted ? 'text-primary' : 'text-muted-foreground'}
                      transition-all duration-300
                      group-hover:translate-x-1
                    `}>
                      <span>ENTER</span>
                      <span className="text-primary">→</span>
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  <div className={`
                    absolute inset-0 rounded-lg transition-opacity duration-300
                    ${isHighlighted ? 'opacity-100' : 'opacity-0'}
                  `}
                    style={{
                      background: 'radial-gradient(circle at center, rgba(var(--primary), 0.1) 0%, transparent 70%)'
                    }}
                  />
                </div>
              </Component>
            )
          })}
        </div>

      {/* Alien Navigator Mascot - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative w-24 h-24 animate-bounce" style={{ animationDuration: '3s' }}>
          <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,255,0,0.8)]">
            {/* Compass behind alien */}
            <circle cx="50" cy="75" r="18" fill="rgba(0,255,0,0.2)" stroke="rgba(0,255,0,0.6)" strokeWidth="2" />
            <path d="M 50 60 L 50 90 M 35 75 L 65 75" stroke="rgba(0,255,0,0.8)" strokeWidth="1.5" />
            <polygon points="50,62 48,70 52,70" fill="rgba(0,255,0,1)">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 75"
                to="360 50 75"
                dur="4s"
                repeatCount="indefinite"
              />
            </polygon>
            
            {/* Alien head */}
            <ellipse cx="50" cy="35" rx="22" ry="28" fill="url(#alienGradient)" />
            
            {/* Eyes */}
            <ellipse cx="42" cy="32" rx="6" ry="9" fill="rgba(0,0,0,0.9)" />
            <ellipse cx="58" cy="32" rx="6" ry="9" fill="rgba(0,0,0,0.9)" />
            <ellipse cx="44" cy="30" rx="2" ry="3" fill="rgba(255,255,255,0.8)">
              <animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="60" cy="30" rx="2" ry="3" fill="rgba(255,255,255,0.8)">
              <animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite" />
            </ellipse>
            
            {/* Smile */}
            <path d="M 42 45 Q 50 48 58 45" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none" strokeLinecap="round" />
            
            {/* Antennas */}
            <line x1="38" y1="12" x2="35" y2="5" stroke="rgba(0,255,0,0.8)" strokeWidth="2" strokeLinecap="round" />
            <line x1="62" y1="12" x2="65" y2="5" stroke="rgba(0,255,0,0.8)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="35" cy="5" r="3" fill="rgba(0,255,0,1)">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="65" cy="5" r="3" fill="rgba(0,255,0,1)">
              <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
            </circle>
            
            {/* Body */}
            <ellipse cx="50" cy="55" rx="15" ry="8" fill="url(#alienGradient)" opacity="0.9" />
            
            <defs>
              <linearGradient id="alienGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'rgb(100,255,100)', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: 'rgb(0,255,0)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(0,200,0)', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

        {/* Polymarket Integration Card */}
        <div className="relative z-10 mt-8 mb-6">
          {/* Alien Guide standing on top of the card */}
          <div className="absolute -top-24 right-8 z-30">
            <div className="relative w-32 h-48 animate-bounce" style={{ animationDuration: '3s' }}>
              <Image 
                src="/alien-guide.png" 
                alt="Alien Navigator Guide"
                width={128}
                height={192}
                className="drop-shadow-[0_0_25px_rgba(0,255,0,0.7)] hover:scale-110 transition-transform duration-300"
                priority
              />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border-2 border-purple-500/30 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">📊</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-purple-400 font-mono">POLYMARKET_INTEGRATION</h3>
                  <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/50">OFFICIAL</span>
                </div>
                <p className="text-sm text-muted-foreground font-mono mb-3">
                  SpaceHub tracks smart money on <span className="text-purple-400 font-bold">Polymarket</span> - the world&apos;s largest prediction market. 
                  See where top traders are positioning, analyze trends, and make informed decisions.
                </p>
                <a 
                  href="https://polymarket.com/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 hover:border-purple-500 rounded-md text-sm font-mono text-purple-300 hover:text-purple-200 transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                >
                  <span>🚀 VISIT_POLYMARKET</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom hint */}
        <div className="relative z-10 text-center">
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-primary">👽 TIP:</span> Hover over stations to activate mission paths
          </p>
        </div>

      </div>
    </div>
  )
}
