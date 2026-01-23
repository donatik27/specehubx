'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Flame } from 'lucide-react'

interface TickerMarket {
  question: string
  category: string
  volume: number
  yesPrice: number
  priceChange: number // % зміна
  trending: 'up' | 'down' | 'hot'
  slug?: string // Polymarket slug for URL
}

export default function MarketTicker() {
  const [markets, setMarkets] = useState<TickerMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHotMarkets()
    // Оновлюємо кожні 30 секунд
    const interval = setInterval(fetchHotMarkets, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchHotMarkets = async () => {
    try {
      // Use regular markets API for active, high-volume markets
      const response = await fetch('/api/markets')
      if (!response.ok) throw new Error('Failed to fetch')
      
      const allMarkets = await response.json()
      
      // Фільтруємо активні маркети і сортуємо по volume
      const activeMarkets = allMarkets
        .filter((m: any) => {
          // Note: /api/markets doesn't return 'status' field, so we only check endDate
          const notExpired = !m.endDate || new Date(m.endDate) > new Date()
          const hasVolume = (m.volume || 0) > 10000 // At least $10k volume
          return notExpired && hasVolume
        })
        .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 15) // Top 15 маркетів
      
      // Форматуємо для ticker
      const hotMarkets: TickerMarket[] = activeMarkets.map((m: any) => {
        // Parse outcome prices
        let yesPrice = 0.5
        if (m.outcomePrices) {
          const prices = Array.isArray(m.outcomePrices) 
            ? m.outcomePrices 
            : [m.outcomePrices]
          yesPrice = parseFloat(prices[0]) || 0.5
        }
        
        // Simulate price change based on current price
        // Markets near 50% are "hot", extremes show direction
        const priceChange = yesPrice > 0.7 ? Math.random() * 5 + 2 
                          : yesPrice < 0.3 ? -(Math.random() * 5 + 2)
                          : (Math.random() - 0.5) * 4
        
        return {
          question: m.question,
          category: m.category || 'Uncategorized',
          volume: m.volume || 0,
          yesPrice: yesPrice * 100, // Convert to %
          priceChange,
          trending: priceChange > 2 ? 'up' : priceChange < -2 ? 'down' : 'hot',
          slug: m.eventSlug || m.slug
        }
      })
      
      setMarkets(hotMarkets)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch hot markets:', error)
      setLoading(false)
    }
  }

  if (loading || markets.length === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t-2 border-primary/50 h-10 flex items-center justify-center z-50">
        <p className="text-primary font-mono text-xs animate-pulse">LOADING_HOT_MARKETS...</p>
      </div>
    )
  }

  // Дублюємо маркети для безперервної стрічки
  const duplicatedMarkets = [...markets, ...markets, ...markets]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t-2 border-primary/50 h-10 overflow-hidden z-50">
      <div className="flex items-center h-full">
        {/* Лейбл */}
        <div className="bg-primary px-4 h-full flex items-center gap-2 flex-shrink-0">
          <Flame className="h-4 w-4 text-black animate-pulse" />
          <span className="text-black font-bold font-mono text-xs">HOT_MARKETS</span>
        </div>

        {/* Бігуча стрічка */}
        <div className="flex-1 overflow-hidden relative">
          <div className="ticker-wrapper">
            <div className="ticker-content">
              {duplicatedMarkets.map((market, idx) => {
                // Generate Polymarket URL
                const polymarketUrl = market.slug
                  ? `https://polymarket.com/event/${market.slug}?via=01k`
                  : `https://polymarket.com/search?q=${encodeURIComponent(market.question)}&referral=01k`
                
                return (
                  <a
                    key={idx}
                    href={polymarketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 border-r border-primary/30 hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    {/* Icon */}
                    {market.trending === 'up' && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    {market.trending === 'down' && (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    {market.trending === 'hot' && (
                      <Flame className="h-4 w-4 text-[#FFD700]" />
                    )}

                    {/* Question */}
                    <span className="text-white font-mono text-xs font-bold whitespace-nowrap">
                      {market.question.length > 60
                        ? market.question.slice(0, 60) + '...'
                        : market.question}
                    </span>

                    {/* Price */}
                    <span className="text-primary font-mono text-xs">
                      YES: {market.yesPrice.toFixed(0)}¢
                    </span>

                    {/* Change */}
                    <span
                      className={`font-mono text-xs font-bold ${
                        market.priceChange > 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {market.priceChange > 0 ? '+' : ''}
                      {market.priceChange.toFixed(1)}%
                    </span>

                    {/* Volume */}
                    <span className="text-muted-foreground font-mono text-xs">
                      VOL: ${(market.volume / 1000000).toFixed(1)}M
                    </span>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticker-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .ticker-content {
          display: flex;
          animation: scroll 45s linear infinite;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
