'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Home, Users, Target, Globe, Bell, Activity, TrendingUp } from 'lucide-react'

interface SiteNode {
  id: string
  title: string
  description: string
  route: string
  icon: React.ReactNode
  status: 'LIVE' | 'BETA' | 'SOON'
  position: { row: number; col: number }
}

const NODES: SiteNode[] = [
  {
    id: 'home',
    title: 'COMMAND_CENTER',
    description: 'Real-time dashboard with trader stats',
    route: '/',
    icon: <Home className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 0, col: 2 }
  },
  {
    id: 'traders',
    title: 'TRADER_INTEL',
    description: 'Top performers by PnL & score',
    route: '/traders',
    icon: <Users className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 1, col: 0 }
  },
  {
    id: 'alpha',
    title: 'ALPHA_MARKETS',
    description: 'Where smart money is positioned',
    route: '/markets/smart',
    icon: <Target className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 1, col: 2 }
  },
  {
    id: 'radar',
    title: 'TRADER_RADAR',
    description: '3D globe with trader locations',
    route: '/map',
    icon: <Globe className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 1, col: 3 }
  },
  {
    id: 'alerts',
    title: 'ALERTS',
    description: 'Telegram notifications for trades',
    route: '/alerts',
    icon: <Bell className="w-6 h-6" />,
    status: 'BETA',
    position: { row: 1, col: 4 }
  },
  {
    id: 'markets',
    title: 'MARKETS',
    description: 'Browse all prediction markets',
    route: '/markets',
    icon: <TrendingUp className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 2, col: 2 }
  },
  {
    id: 'diagnostics',
    title: 'DIAGNOSTICS',
    description: 'System health & data freshness',
    route: '/health',
    icon: <Activity className="w-6 h-6" />,
    status: 'LIVE',
    position: { row: 3, col: 2 }
  }
]

const CONNECTIONS = [
  { from: 'home', to: 'traders' },
  { from: 'home', to: 'alpha' },
  { from: 'home', to: 'radar' },
  { from: 'home', to: 'alerts' },
  { from: 'traders', to: 'markets' },
  { from: 'alpha', to: 'markets' },
  { from: 'radar', to: 'markets' },
  { from: 'markets', to: 'diagnostics' }
]

export default function SiteMapNeural() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Get connected nodes for glow effect
  const getConnectedNodes = (nodeId: string): string[] => {
    const connected = new Set([nodeId])
    CONNECTIONS.forEach(conn => {
      if (conn.from === nodeId) connected.add(conn.to)
      if (conn.to === nodeId) connected.add(conn.from)
    })
    return Array.from(connected)
  }

  const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode) : []

  return (
    <div className="mb-12 relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-2xl font-bold text-primary font-mono">
            🧠 NEURAL_NETWORK_MAP
          </h2>
        </div>
        <p className="text-muted-foreground text-sm font-mono">
          &gt; NAVIGATE_THROUGH_SPACEHUB_ECOSYSTEM
        </p>
      </div>

      {/* Neural Network Grid */}
      <div className="relative bg-card/30 backdrop-blur-sm rounded-lg border border-primary/20 p-8 overflow-hidden">
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

          {CONNECTIONS.map((conn, i) => {
            const fromNode = NODES.find(n => n.id === conn.from)
            const toNode = NODES.find(n => n.id === conn.to)
            if (!fromNode || !toNode) return null

            // Calculate positions (approximate, will adjust based on actual layout)
            const fromX = 50 + (fromNode.position.col - 2) * 200
            const fromY = 80 + fromNode.position.row * 150
            const toX = 50 + (toNode.position.col - 2) * 200
            const toY = 80 + toNode.position.row * 150

            const isHighlighted = hoveredNode && (
              connectedNodes.includes(conn.from) && connectedNodes.includes(conn.to)
            )

            return (
              <g key={`${conn.from}-${conn.to}`}>
                {/* Connection line */}
                <line
                  x1={`${fromX}px`}
                  y1={`${fromY}px`}
                  x2={`${toX}px`}
                  y2={`${toY}px`}
                  stroke={isHighlighted ? 'rgb(var(--primary))' : 'url(#lineGradient)'}
                  strokeWidth={isHighlighted ? "3" : "2"}
                  className="transition-all duration-300"
                  style={{
                    filter: isHighlighted ? 'url(#glow)' : 'none',
                    opacity: isHighlighted ? 1 : 0.3
                  }}
                />
                
                {/* Animated particle */}
                {isHighlighted && (
                  <circle r="4" fill="rgb(var(--primary))">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={`M ${fromX} ${fromY} L ${toX} ${toY}`}
                    />
                  </circle>
                )}
              </g>
            )
          })}
        </svg>

        {/* Nodes Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-6" style={{ minHeight: '500px' }}>
          {NODES.map((node) => {
            const isHighlighted = connectedNodes.includes(node.id)
            const isCenter = node.id === 'home'
            
            return (
              <Link
                key={node.id}
                href={node.route}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={`
                  relative group
                  ${isCenter ? 'md:col-start-3' : ''}
                  ${node.id === 'traders' ? 'md:col-start-1' : ''}
                  ${node.id === 'alpha' ? 'md:col-start-3' : ''}
                  ${node.id === 'radar' ? 'md:col-start-4' : ''}
                  ${node.id === 'alerts' ? 'md:col-start-5' : ''}
                  ${node.id === 'markets' ? 'md:col-start-3' : ''}
                  ${node.id === 'diagnostics' ? 'md:col-start-3' : ''}
                `}
                style={{
                  gridRow: node.position.row + 1
                }}
              >
                <div
                  className={`
                    relative overflow-hidden
                    bg-gradient-to-br from-card/80 to-card/40
                    backdrop-blur-sm
                    border-2 rounded-lg p-4
                    transition-all duration-300
                    ${isHighlighted 
                      ? 'border-primary shadow-[0_0_20px_rgba(var(--primary),0.5)] scale-105' 
                      : 'border-primary/30 hover:border-primary/60'
                    }
                    ${isCenter ? 'ring-2 ring-primary/50' : ''}
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
                        p-2 rounded-md
                        ${isHighlighted ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary/70'}
                        transition-all duration-300
                        group-hover:scale-110
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
              </Link>
            )
          })}
        </div>

        {/* Bottom hint */}
        <div className="relative z-10 mt-8 text-center">
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-primary">TIP:</span> Hover over nodes to see connections
          </p>
        </div>
      </div>
    </div>
  )
}
