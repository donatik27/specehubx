'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface Trader {
  address: string
  displayName: string
  avatar: string
  estimatedPnL: number
  tier: string
  verified?: boolean
}

interface Position {
  market_id: string
  market_title: string
  outcome: string
  size: number
  current_price: number
  avg_entry_price: number
  unrealized_pnl: number
  value: number
}

interface Props {
  trader: Trader
  positions: Position[]
}

interface Node extends d3.SimulationNodeDatum {
  id: string
  type: 'trader' | 'position'
  label: string
  avatar?: string
  pnl?: number
  size?: number
  color?: string
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
}

export default function TraderBubblesGraph({ trader, positions }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })

  useEffect(() => {
    if (!svgRef.current || positions.length === 0) return

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove()

    const width = dimensions.width
    const height = dimensions.height

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])

    // Create container for zoom
    const container = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Prepare data
    const nodes: Node[] = []
    const links: Link[] = []

    // Central trader node
    const traderNode: Node = {
      id: 'trader',
      type: 'trader',
      label: trader.displayName,
      avatar: trader.avatar,
      pnl: trader.estimatedPnL,
      size: 80,
      color: '#8b5cf6', // purple
      fx: width / 2, // Fix in center
      fy: height / 2
    }
    nodes.push(traderNode)

    // Position nodes
    positions.forEach((pos, idx) => {
      const posNode: Node = {
        id: `pos-${idx}`,
        type: 'position',
        label: `${pos.market_title.substring(0, 40)}...`,
        pnl: pos.unrealized_pnl,
        size: Math.min(Math.max(Math.abs(pos.unrealized_pnl) / 10, 20), 60),
        color: pos.unrealized_pnl >= 0 ? '#22c55e' : '#ef4444' // green or red
      }
      nodes.push(posNode)

      // Link from trader to position
      links.push({
        source: 'trader',
        target: `pos-${idx}`
      })
    })

    console.log(`🫧 Graph: ${nodes.length} nodes, ${links.length} links`)

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(200)
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody()
        .strength(-300)
      )
      .force('collision', d3.forceCollide()
        .radius(d => (d as Node).size! + 20)
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))

    // Create links (lines)
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Create node groups
    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          // Keep position fixed after drag
          // d.fx = null
          // d.fy = null
        })
      )

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.size!)
      .attr('fill', d => d.color!)
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 0 10px rgba(0,0,0,0.5))')

    // Add images for trader node
    node.filter(d => d.type === 'trader')
      .append('image')
      .attr('href', d => d.avatar!)
      .attr('x', d => -d.size! * 0.7)
      .attr('y', d => -d.size! * 0.7)
      .attr('width', d => d.size! * 1.4)
      .attr('height', d => d.size! * 1.4)
      .attr('clip-path', 'circle()')

    // Add PnL labels
    node.append('text')
      .attr('y', d => d.type === 'trader' ? d.size! + 25 : 0)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.type === 'trader' ? '#fff' : d.color!)
      .attr('font-size', d => d.type === 'trader' ? '18px' : '14px')
      .attr('font-weight', 'bold')
      .attr('stroke', '#000')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .text(d => {
        if (d.type === 'trader') {
          return d.label
        }
        const pnl = d.pnl || 0
        return pnl >= 0 ? `+$${pnl.toFixed(0)}` : `-$${Math.abs(pnl).toFixed(0)}`
      })

    // Add market title on hover
    node.append('title')
      .text(d => {
        if (d.type === 'trader') {
          return `${d.label}\nTotal PnL: $${d.pnl?.toFixed(2)}`
        }
        return `${d.label}\nUnrealized P&L: $${d.pnl?.toFixed(2)}`
      })

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Initial zoom to fit
    svg.call(zoom.transform as any, d3.zoomIdentity)

    return () => {
      simulation.stop()
    }
  }, [trader, positions, dimensions])

  // Responsive dimensions
  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.min(container.clientWidth * 0.6, 800)
        })
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="relative w-full" style={{ height: `${dimensions.height}px` }}>
      <svg
        ref={svgRef}
        className="w-full h-full bg-black/20 rounded-lg pixel-border border-white/10"
      />

      {positions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl mb-4">🫧</p>
            <p className="text-xl text-muted-foreground">No open positions</p>
            <p className="text-sm text-muted-foreground mt-2">
              This trader has no active positions at the moment
            </p>
          </div>
        </div>
      )}

      {/* Stats overlay */}
      {positions.length > 0 && (
        <div className="absolute top-4 left-4 bg-black/80 pixel-border border-primary/40 p-4 text-sm">
          <p className="text-white font-bold mb-2">POSITION STATS:</p>
          <p className="text-green-400">
            🟢 Profitable: {positions.filter(p => p.unrealized_pnl > 0).length}
          </p>
          <p className="text-red-400">
            🔴 Losing: {positions.filter(p => p.unrealized_pnl < 0).length}
          </p>
          <p className="text-white mt-2">
            Total Unrealized P&L:{' '}
            <span className={positions.reduce((sum, p) => sum + p.unrealized_pnl, 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
              ${positions.reduce((sum, p) => sum + p.unrealized_pnl, 0).toFixed(2)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
