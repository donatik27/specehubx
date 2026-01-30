'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import TraderBubblesGraph from '@/components/TraderBubblesGraph'

interface Trader {
  address: string
  displayName: string
  avatar: string
  estimatedPnL: number
  tier: string
  verified?: boolean
  xUsername?: string
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

export default function TraderBubblesPage() {
  const params = useParams()
  const router = useRouter()
  const address = params?.address as string

  const [trader, setTrader] = useState<Trader | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    fetchTraderData()
  }, [address])

  const fetchTraderData = async () => {
    try {
      setLoading(true)

      // Fetch trader info
      const traderRes = await fetch(`/api/trader/${address}`)
      if (traderRes.ok) {
        const traderData = await traderRes.json()
        setTrader(traderData)
      }

      // Fetch open positions from Polymarket CLOB API
      console.log('🔍 Fetching open positions from Polymarket CLOB...')
      const positionsRes = await fetch(
        `https://clob.polymarket.com/positions?user=${address}`
      )

      if (positionsRes.ok) {
        const positionsData = await positionsRes.json()
        console.log(`📊 Fetched ${positionsData.length} open positions!`)
        setPositions(positionsData)
      } else {
        console.error('❌ Failed to fetch positions:', positionsRes.status)
      }
    } catch (error) {
      console.error('❌ Error fetching trader data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🫧</div>
              <p className="text-xl text-muted-foreground">Loading Bubbles...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!trader) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-xl text-red-500">Trader not found</p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-primary hover:underline"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold">&lt; BACK_TO_PROFILE</span>
          </button>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">🫧</span>
              POSITION BUBBLES
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {trader.displayName} • {positions.length} Open Positions
            </p>
          </div>
        </div>

        {/* Bubbles Graph */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <TraderBubblesGraph
            trader={trader}
            positions={positions}
          />
        </div>

        {/* Legend */}
        <div className="mt-6 bg-card pixel-border border-white/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4">HOW TO USE:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-green-400 font-bold mb-1">🟢 GREEN BUBBLES</p>
              <p className="text-muted-foreground">Profitable positions (unrealized gain)</p>
            </div>
            <div>
              <p className="text-red-400 font-bold mb-1">🔴 RED BUBBLES</p>
              <p className="text-muted-foreground">Losing positions (unrealized loss)</p>
            </div>
            <div>
              <p className="text-primary font-bold mb-1">🎯 CENTRAL HUB</p>
              <p className="text-muted-foreground">Trader profile (drag to move)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
