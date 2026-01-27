'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Activity } from 'lucide-react'

interface PricePoint {
  timestamp: number
  price: number
  time: string
}

interface PriceChartProps {
  marketId: string
  yesPrice: number
  noPrice: number
  yesTokenId?: string
}

export function PriceChart({ marketId, yesPrice, noPrice, yesTokenId }: PriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '1D' | '1W' | 'ALL'>('1D')
  const [loading, setLoading] = useState(false)
  const [useRealData, setUseRealData] = useState(true)

  useEffect(() => {
    const fetchPriceHistory = async () => {
      // If no tokenId, use mock data
      if (!yesTokenId || !useRealData) {
        const mockHistory = generateMockHistory(yesPrice, timeRange)
        const now = Date.now()
        const currentPoint: PricePoint = {
          timestamp: now,
          price: yesPrice,
          time: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }
        setPriceHistory([...mockHistory, currentPoint])
        return
      }

      try {
        setLoading(true)
        
        // Always fetch ALL data from Polymarket, then filter client-side
        const response = await fetch(
          `/api/price-history?tokenId=${yesTokenId}&interval=max`
        )

        if (!response.ok) {
          console.warn('Failed to fetch real price history, using mock data')
          setUseRealData(false)
          return
        }

        const data = await response.json()
        
        if (data.history && data.history.length > 0) {
          // Filter data based on timeRange
          const now = Date.now()
          const timeRangeMs = {
            '1H': 60 * 60 * 1000,
            '6H': 6 * 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
            'ALL': Infinity
          }
          const cutoff = now - timeRangeMs[timeRange]
          
          // Filter and sample data points based on timeRange
          let filteredData = data.history.filter((point: PricePoint) => point.timestamp >= cutoff)
          
          // Sample data to keep chart responsive (max 100 points)
          if (filteredData.length > 100) {
            const step = Math.ceil(filteredData.length / 100)
            filteredData = filteredData.filter((_: any, i: number) => i % step === 0)
          }
          
          setPriceHistory(filteredData)
          console.log(`✅ Loaded ${filteredData.length} real price points (${timeRange})`)
        } else {
          // Fallback to mock if no data
          setUseRealData(false)
        }

      } catch (error) {
        console.error('Error fetching price history:', error)
        setUseRealData(false)
      } finally {
        setLoading(false)
      }
    }

    fetchPriceHistory()
  }, [marketId, yesTokenId, timeRange])

  // Update chart with live prices
  useEffect(() => {
    setPriceHistory(prev => {
      const now = Date.now()
      const newPoint: PricePoint = {
        timestamp: now,
        price: yesPrice,
        time: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }
      
      // Keep only relevant data points based on time range
      const cutoffTime = now - getTimeRangeMs(timeRange)
      const filtered = prev.filter(p => p.timestamp > cutoffTime)
      
      return [...filtered, newPoint].slice(-100) // Keep last 100 points
    })
  }, [yesPrice, noPrice, timeRange])

  const latestChange = priceHistory.length >= 2
    ? priceHistory[priceHistory.length - 1].price - priceHistory[priceHistory.length - 2].price
    : 0

  const volumeDisplay = '$11.84M Vol.' // TODO: Get from market data

  return (
    <div className="bg-card pixel-border border-primary/40 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary alien-glow" />
          <div className="flex items-center gap-4">
            <div>
              <span className="text-3xl font-bold text-primary">
                {(yesPrice * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-muted-foreground ml-2">chance</span>
            </div>
            <div className={`text-sm font-mono ${latestChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {latestChange >= 0 ? '▲' : '▼'} {Math.abs(latestChange * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['1H', '6H', '1D', '1W', 'ALL'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs font-bold transition-all ${
                timeRange === range
                  ? 'text-primary underline'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-black/40 pixel-border border-white/10 p-2" style={{ height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#333"
              tick={{ fill: '#666', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#333' }}
              tickFormatter={(value) => {
                // Format based on timeRange
                if (timeRange === '1H' || timeRange === '6H') {
                  // Show time only for short ranges
                  return value.split(',')[1]?.trim() || value
                }
                return value
              }}
            />
            <YAxis 
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              stroke="#333"
              tick={{ fill: '#666', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#333' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: '#00ff00', fontWeight: 'bold', fontSize: '11px' }}
              formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Chance']}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#00ff00" 
              strokeWidth={2}
              dot={false}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Info */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-mono">
          {volumeDisplay}
        </div>
        {!useRealData && (
          <div className="text-xs text-yellow-500 font-mono">
            ⚠️ Simulated data
          </div>
        )}
        {loading && (
          <div className="text-xs text-primary font-mono animate-pulse">
            Loading...
          </div>
        )}
      </div>
    </div>
  )
}

// Helper: Get time range in milliseconds
function getTimeRangeMs(range: '1H' | '6H' | '1D' | '1W' | 'ALL'): number {
  switch (range) {
    case '1H': return 60 * 60 * 1000
    case '6H': return 6 * 60 * 60 * 1000
    case '1D': return 24 * 60 * 60 * 1000
    case '1W': return 7 * 24 * 60 * 60 * 1000
    case 'ALL': return 30 * 24 * 60 * 60 * 1000 // 30 days for now
  }
}

// Helper: Generate mock historical data
// TODO: Replace with real API fetch
function generateMockHistory(currentPrice: number, range: '1H' | '6H' | '1D' | '1W' | 'ALL'): PricePoint[] {
  const points: PricePoint[] = []
  const now = Date.now()
  const rangeMs = getTimeRangeMs(range)
  
  // Number of points based on range
  const numPoints = range === '1H' ? 12 : 
                    range === '6H' ? 24 : 
                    range === '1D' ? 48 : 
                    range === '1W' ? 84 : 120
  
  const interval = rangeMs / numPoints

  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - rangeMs + (i * interval)
    
    // Create realistic price movement
    const progress = i / numPoints
    const volatility = 0.15 * (1 - progress) // Less volatile near current time
    const trend = (currentPrice - 0.5) * progress // Trend towards current price
    const noise = (Math.random() - 0.5) * volatility
    
    const price = Math.max(0.01, Math.min(0.99, 0.5 + trend + noise))

    // Format time based on range
    let timeFormat: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit' 
    }
    
    if (range === '1W' || range === 'ALL') {
      timeFormat = { 
        month: 'short', 
        day: 'numeric'
      }
    }

    points.push({
      timestamp,
      price,
      time: new Date(timestamp).toLocaleString('en-US', timeFormat)
    })
  }

  return points
}
