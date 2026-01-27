'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity, TrendingUp, TrendingDown } from 'lucide-react'

interface PricePoint {
  timestamp: number
  yesPrice: number
  noPrice: number
  time: string
}

interface PriceChartProps {
  marketId: string
  yesPrice: number
  noPrice: number
}

export function PriceChart({ marketId, yesPrice, noPrice }: PriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D' | '30D'>('24H')

  useEffect(() => {
    // Initialize with current prices
    const now = Date.now()
    const initialPoint: PricePoint = {
      timestamp: now,
      yesPrice,
      noPrice,
      time: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    
    // Generate mock historical data (for now)
    // TODO: Replace with real API call to fetch historical prices
    const mockHistory = generateMockHistory(yesPrice, noPrice, timeRange)
    setPriceHistory([...mockHistory, initialPoint])
  }, [marketId, timeRange])

  // Update chart with live prices
  useEffect(() => {
    setPriceHistory(prev => {
      const now = Date.now()
      const newPoint: PricePoint = {
        timestamp: now,
        yesPrice,
        noPrice,
        time: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }
      
      // Keep only relevant data points based on time range
      const cutoffTime = now - getTimeRangeMs(timeRange)
      const filtered = prev.filter(p => p.timestamp > cutoffTime)
      
      return [...filtered, newPoint].slice(-100) // Keep last 100 points
    })
  }, [yesPrice, noPrice, timeRange])

  const latestChange = priceHistory.length >= 2
    ? priceHistory[priceHistory.length - 1].yesPrice - priceHistory[priceHistory.length - 2].yesPrice
    : 0

  const isPositive = latestChange >= 0

  return (
    <div className="bg-card pixel-border border-primary/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary alien-glow" />
          <h2 className="text-2xl font-bold text-primary">PRICE_CHART</h2>
          <span className="flex items-center gap-1 text-xs text-primary/70 font-mono">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            LIVE
          </span>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['1H', '24H', '7D', '30D'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-bold pixel-border transition-all ${
                timeRange === range
                  ? 'bg-primary text-black border-primary'
                  : 'bg-black/40 text-white border-white/20 hover:border-primary/50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Current Prices */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-500/10 pixel-border border-green-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-green-400 font-bold uppercase">YES</span>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {(yesPrice * 100).toFixed(1)}¢
          </div>
          <div className={`text-sm font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{(latestChange * 100).toFixed(2)}%
          </div>
        </div>

        <div className="bg-red-500/10 pixel-border border-red-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-400 font-bold uppercase">NO</span>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {(noPrice * 100).toFixed(1)}¢
          </div>
          <div className={`text-sm font-mono ${!isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {!isPositive ? '+' : ''}{(-latestChange * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-black/40 pixel-border border-white/10 p-4" style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="time" 
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              tickLine={{ stroke: '#666' }}
            />
            <YAxis 
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}¢`}
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              tickLine={{ stroke: '#666' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#000',
                border: '2px solid #00ff00',
                borderRadius: 0,
                fontFamily: 'monospace',
                fontSize: 12
              }}
              labelStyle={{ color: '#00ff00', fontWeight: 'bold' }}
              formatter={(value: number) => [`${(value * 100).toFixed(1)}¢`, '']}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="yesPrice" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
              name="YES"
              animationDuration={300}
            />
            <Line 
              type="monotone" 
              dataKey="noPrice" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={false}
              name="NO"
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-yellow-500/10 pixel-border border-yellow-500/30 text-xs text-yellow-500 font-mono">
        ℹ️ Historical data simulation. Real-time tracking active.
      </div>
    </div>
  )
}

// Helper: Get time range in milliseconds
function getTimeRangeMs(range: '1H' | '24H' | '7D' | '30D'): number {
  switch (range) {
    case '1H': return 60 * 60 * 1000
    case '24H': return 24 * 60 * 60 * 1000
    case '7D': return 7 * 24 * 60 * 60 * 1000
    case '30D': return 30 * 24 * 60 * 60 * 1000
  }
}

// Helper: Generate mock historical data
// TODO: Replace with real API fetch
function generateMockHistory(currentYes: number, currentNo: number, range: '1H' | '24H' | '7D' | '30D'): PricePoint[] {
  const points: PricePoint[] = []
  const now = Date.now()
  const rangeMs = getTimeRangeMs(range)
  const numPoints = range === '1H' ? 12 : range === '24H' ? 24 : range === '7D' ? 21 : 30
  const interval = rangeMs / numPoints

  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - rangeMs + (i * interval)
    
    // Create realistic price movement
    const progress = i / numPoints
    const volatility = 0.1 * (1 - progress) // Less volatile near current time
    const trend = (currentYes - 0.5) * progress // Trend towards current price
    const noise = (Math.random() - 0.5) * volatility
    
    const yesPrice = Math.max(0.01, Math.min(0.99, 0.5 + trend + noise))
    const noPrice = 1 - yesPrice

    points.push({
      timestamp,
      yesPrice,
      noPrice,
      time: new Date(timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        ...(range === '7D' || range === '30D' ? { month: 'short', day: 'numeric' } : {})
      })
    })
  }

  return points
}
