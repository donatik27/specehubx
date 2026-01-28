'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import Draggable from 'react-draggable'

interface WhaleBubble {
  id: string // wallet address
  wallet: string
  amount: number
  side: 'YES' | 'NO'
  color: string
  size: number // pixel size for bubble
}

interface WhaleNetworkGraphProps {
  marketId: string
  minAmount?: number
}

export default function WhaleNetworkGraph({ 
  marketId, 
  minAmount = 1000 
}: WhaleNetworkGraphProps) {
  const [marketInfo, setMarketInfo] = useState<{ title: string; volume: number; image: string } | null>(null)
  const [yesWhales, setYesWhales] = useState<WhaleBubble[]>([])
  const [noWhales, setNoWhales] = useState<WhaleBubble[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWhaleNetwork = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Step 1: Fetch market info
      let marketTitle = 'Market'
      let marketVolume = 0
      let marketImage = ''
      
      try {
        const marketInfoResponse = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`, {
          cache: 'no-store'
        })
        if (marketInfoResponse.ok) {
          const marketInfo = await marketInfoResponse.json()
          marketTitle = marketInfo.question || 'Market'
          marketVolume = parseFloat(marketInfo.volume || marketInfo.volumeNum || '0')
          marketImage = marketInfo.image || marketInfo.icon || ''
        }
      } catch (err) {
        console.warn('[WhaleNetworkGraph] Failed to fetch market info:', err)
      }

      // Step 2: Fetch trades
      const response = await fetch(`/api/market-trades?market=${marketId}&limit=1000`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to fetch trades')
      }
      
      const trades: any[] = Array.isArray(data) ? data : []
      
      if (trades.length === 0) {
        throw new Error('No trades available for this market yet')
      }

      // Aggregate trades per wallet
      const walletMap = new Map<string, { 
        amount: number
        yesTrades: number
        noTrades: number
      }>()
      
      trades.forEach((trade: any) => {
        const wallet = trade.proxyWallet || trade.user || 'unknown'
        if (wallet === 'unknown') return

        // Use outcome to determine YES/NO
        const outcomeRaw = String(trade.outcome || '').toLowerCase()
        let outcomeSide: 'YES' | 'NO' | null = null
        if (trade.outcomeIndex === 0 || outcomeRaw === 'yes') outcomeSide = 'YES'
        if (trade.outcomeIndex === 1 || outcomeRaw === 'no') outcomeSide = 'NO'
        if (!outcomeSide) return

        const price = parseFloat(trade.price || '0')
        const size = parseFloat(trade.size || '0')
        const amount = price * size

        if (walletMap.has(wallet)) {
          const data = walletMap.get(wallet)!
          data.amount += amount
          if (outcomeSide === 'YES') data.yesTrades += amount
          else data.noTrades += amount
        } else {
          walletMap.set(wallet, {
            amount,
            yesTrades: outcomeSide === 'YES' ? amount : 0,
            noTrades: outcomeSide === 'NO' ? amount : 0,
          })
        }
      })

      // Filter and sort - TOP 50 whales
      const filteredWallets = Array.from(walletMap.entries())
        .filter(([_, data]) => data.amount >= minAmount)
        .sort(([_, a], [__, b]) => b.amount - a.amount)
        .slice(0, 50)

      console.log(`🐋 Showing top ${filteredWallets.length} whales (min $${minAmount})`)

      // Create bubbles with sizes
      const bubbles: WhaleBubble[] = filteredWallets.map(([wallet, data]) => {
        const side: 'YES' | 'NO' = data.yesTrades > data.noTrades ? 'YES' : 'NO'
        
        // Color based on side and amount
        let color = side === 'YES' ? '#22c55e' : '#ef4444'
        if (data.amount > 10000) {
          color = side === 'YES' ? '#10b981' : '#dc2626'
        } else if (data.amount > 5000) {
          color = side === 'YES' ? '#16a34a' : '#e11d48'
        }
        
        // Calculate bubble size (60px to 200px)
        const minSize = 60
        const maxSize = 200
        const maxAmount = Math.max(...filteredWallets.map(([_, d]) => d.amount))
        const size = minSize + ((data.amount / maxAmount) * (maxSize - minSize))
        
        return {
          id: wallet,
          wallet,
          amount: data.amount,
          side,
          color,
          size: Math.round(size)
        }
      })

      // Separate YES and NO
      const yes = bubbles.filter(b => b.side === 'YES')
      const no = bubbles.filter(b => b.side === 'NO')

      setMarketInfo({ title: marketTitle, volume: marketVolume, image: marketImage })
      setYesWhales(yes)
      setNoWhales(no)
      setLoading(false)

    } catch (err) {
      console.error('Failed to fetch whale network:', err)
      setError('Failed to load whale network')
      setLoading(false)
    }
  }, [marketId, minAmount])

  useEffect(() => {
    fetchWhaleNetwork()
  }, [fetchWhaleNetwork])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <span className="ml-3 text-sm text-muted-foreground font-mono">Loading whales...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-red-500 pixel-border border-red-500/40 p-8 bg-black/80">
          <p className="font-bold mb-2 text-2xl">⚠️ Error</p>
          <p className="text-sm font-mono">{error}</p>
        </div>
      </div>
    )
  }

  const totalWhales = yesWhales.length + noWhales.length
  const volumeText = marketInfo?.volume 
    ? marketInfo.volume > 1000000 
      ? `$${(marketInfo.volume / 1000000).toFixed(2)}M`
      : `$${(marketInfo.volume / 1000).toFixed(0)}K`
    : '$0'

  return (
    <div className="fixed inset-0 bg-black overflow-auto">
      {/* Floating Stats (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-40 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 px-4 py-2">
        <div className="text-xs font-mono text-muted-foreground">
          <span className="text-green-400 font-bold">{yesWhales.length}</span> YES •{' '}
          <span className="text-red-400 font-bold">{noWhales.length}</span> NO •{' '}
          <span className="text-purple-400 font-bold">{totalWhales}</span> total
        </div>
      </div>

      <div className="min-h-screen p-8">
        {/* MARKET HUB - Top Center */}
        <div className="flex justify-center mb-12">
          <Draggable>
            <div 
              className="relative cursor-move group"
              style={{ width: '250px', height: '250px' }}
            >
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-2xl shadow-purple-500/50 border-4 border-purple-400/50 hover:border-purple-300 transition-all hover:scale-105"
              >
                <div className="text-center">
                  {marketInfo?.image && (
                    <img 
                      src={marketInfo.image} 
                      alt="Market" 
                      className="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
                    />
                  )}
                  <div className="text-white font-bold text-xl mb-1">🎯 MARKET</div>
                  <div className="text-purple-200 text-xs mb-1 px-4 line-clamp-2">
                    {marketInfo?.title || 'Market'}
                  </div>
                  <div className="text-green-400 text-2xl font-bold">{volumeText}</div>
                  <div className="text-purple-300 text-[10px]">Total Volume</div>
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl -z-10 group-hover:bg-purple-400/30 transition-all"></div>
            </div>
          </Draggable>
        </div>

        {/* YES and NO Whales - Two Columns */}
        <div className="grid grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* YES WHALES (LEFT) */}
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-green-400 font-mono mb-1">
                🟢 YES WHALES
              </h2>
              <p className="text-xs text-muted-foreground">
                {yesWhales.length} wallets buying YES
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              {yesWhales.map((whale) => (
                <Draggable key={whale.id}>
                  <div 
                    className="relative cursor-move group"
                    style={{ width: `${whale.size}px`, height: `${whale.size}px` }}
                  >
                    <div
                      className="absolute inset-0 rounded-full flex items-center justify-center shadow-lg border-2 hover:border-white transition-all hover:scale-110"
                      style={{
                        backgroundColor: whale.color,
                        borderColor: `${whale.color}80`
                      }}
                      onClick={() => window.open(`https://polymarket.com/profile/${whale.wallet}`, '_blank')}
                    >
                      <div className="text-center text-white text-xs font-bold">
                        <div className="text-[10px] opacity-80">
                          {whale.wallet.slice(0, 4)}...{whale.wallet.slice(-4)}
                        </div>
                        <div className="text-sm">
                          ${(whale.amount / 1000).toFixed(1)}K
                        </div>
                      </div>
                    </div>
                    {/* Glow */}
                    <div 
                      className="absolute inset-0 rounded-full blur-md -z-10 opacity-50 group-hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: whale.color }}
                    ></div>
                    
                    {/* Tooltip on hover */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/90 pixel-border border-green-500/40 px-3 py-2 text-xs font-mono whitespace-nowrap">
                        <div className="text-green-400 font-bold mb-1">YES WHALE</div>
                        <div className="text-white">{whale.wallet.slice(0, 8)}...{whale.wallet.slice(-6)}</div>
                        <div className="text-green-400 font-bold">${whale.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </Draggable>
              ))}
            </div>
          </div>

          {/* NO WHALES (RIGHT) */}
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-400 font-mono mb-1">
                🔴 NO WHALES
              </h2>
              <p className="text-xs text-muted-foreground">
                {noWhales.length} wallets buying NO
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              {noWhales.map((whale) => (
                <Draggable key={whale.id}>
                  <div 
                    className="relative cursor-move group"
                    style={{ width: `${whale.size}px`, height: `${whale.size}px` }}
                  >
                    <div
                      className="absolute inset-0 rounded-full flex items-center justify-center shadow-lg border-2 hover:border-white transition-all hover:scale-110"
                      style={{
                        backgroundColor: whale.color,
                        borderColor: `${whale.color}80`
                      }}
                      onClick={() => window.open(`https://polymarket.com/profile/${whale.wallet}`, '_blank')}
                    >
                      <div className="text-center text-white text-xs font-bold">
                        <div className="text-[10px] opacity-80">
                          {whale.wallet.slice(0, 4)}...{whale.wallet.slice(-4)}
                        </div>
                        <div className="text-sm">
                          ${(whale.amount / 1000).toFixed(1)}K
                        </div>
                      </div>
                    </div>
                    {/* Glow */}
                    <div 
                      className="absolute inset-0 rounded-full blur-md -z-10 opacity-50 group-hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: whale.color }}
                    ></div>
                    
                    {/* Tooltip on hover */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/90 pixel-border border-red-500/40 px-3 py-2 text-xs font-mono whitespace-nowrap">
                        <div className="text-red-400 font-bold mb-1">NO WHALE</div>
                        <div className="text-white">{whale.wallet.slice(0, 8)}...{whale.wallet.slice(-6)}</div>
                        <div className="text-red-400 font-bold">${whale.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </Draggable>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
