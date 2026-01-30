'use client'
// KILLER TRADER PROFILE - Radar Charts + Bubble Chart! 🔥

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Activity, Wallet } from 'lucide-react'
import Link from 'next/link'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell } from 'recharts'

interface Trader {
  address: string
  displayName: string
  avatar: string
  tier: string
  rarityScore: number
  estimatedPnL: number
  volume: number
  winRate: number
  tradeCount: number
  verified: boolean
  xUsername?: string
}

interface Trade {
  id: string
  timestamp: number
  title: string
  outcome: string
  side: string
  size: number
  price: number
  buyPrice: number
  sellPrice: number
  profit?: number
  category: string
}

interface CategoryMetrics {
    category: string
    count: number
    volume: number
    percentage: number
  // NEW ENHANCED METRICS! 🚀
  avgTradeSize: number
  winRate: number
  totalProfit: number
  roi: number
  avgProfit: number
  biggestWin: number
  biggestLoss: number
  avgHoldTime: number
  consistency: number
  finishedTradesCount: number
  isEstimated?: boolean // Flag to show if metrics are estimated
}

interface ActivityStats {
  lastTrade: number | null
  totalTrades: number
  activeDays: number
  categoryBreakdown: CategoryMetrics[]
  trades?: Trade[]
}

// Format currency in a clear way
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    // Millions: $3.18M
    return `$${(value / 1000000).toFixed(2)}M`
  } else if (Math.abs(value) >= 1000) {
    // Thousands: $175K
    return `$${(value / 1000).toFixed(0)}K`
  } else {
    // Under 1000: $500
    return `$${value.toFixed(0)}`
  }
}

export default function TraderProfilePage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const [trader, setTrader] = useState<Trader | null>(null)
  const [activity, setActivity] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Bot Scan State 🤖
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{
    score: number
    status: 'REAL_HUMAN' | 'SUSPICIOUS' | 'BOT_DETECTED'
    factors: string[]
  } | null>(null)
  const [showScanResult, setShowScanResult] = useState(false)

  // Railway API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://adorable-grace-production-e919.up.railway.app'

  // BOT SCAN LOGIC! 🤖 (More generous scoring!)
  const calculateBotScore = () => {
    if (!trader || !activity) return { score: 85, status: 'REAL_HUMAN' as const, factors: ['✓ Profile verified'] }

    let score = 100 // Start at 100% human
    const factors: string[] = []

    // Factor 1: EXTREME trade frequency (only penalize VERY suspicious behavior)
    if (activity.totalTrades > 0 && activity.activeDays > 0) {
      const tradesPerDay = activity.totalTrades / activity.activeDays
      if (tradesPerDay > 200) {
        score -= 20
        factors.push(`⚠ EXTREME frequency: ${tradesPerDay.toFixed(0)} trades/day`)
      } else if (tradesPerDay > 500) {
        score -= 35
        factors.push(`🚨 Bot-like frequency: ${tradesPerDay.toFixed(0)} trades/day`)
      } else if (tradesPerDay > 50) {
        factors.push(`Active trader: ${tradesPerDay.toFixed(0)} trades/day`)
      }
    }

    // Factor 2: Market diversity (only penalize if VERY concentrated)
    const uniqueMarkets = new Set(activity.trades?.map(t => t.title) || []).size
    if (uniqueMarkets === 1 && activity.totalTrades > 100) {
      score -= 15
      factors.push(`⚠ Only 1 market traded`)
    } else if (uniqueMarkets < 3 && activity.totalTrades > 200) {
      score -= 10
      factors.push(`⚠ Low diversity: ${uniqueMarkets} markets`)
    } else if (uniqueMarkets >= 5) {
      factors.push(`✓ Good diversity: ${uniqueMarkets} markets`)
    }

    // Factor 3: Category concentration (only if 95%+ in one category)
    if (activity.categoryBreakdown.length > 0) {
      const maxCategoryPercentage = Math.max(...activity.categoryBreakdown.map(c => c.percentage))
      if (maxCategoryPercentage > 95 && activity.totalTrades > 100) {
        score -= 12
        factors.push(`⚠ Single category: ${maxCategoryPercentage.toFixed(0)}%`)
      }
    }

    // Factor 4: Robotic timing (VERY strict check - only obvious bots)
    if (activity.trades && activity.trades.length > 20) {
      const timestamps = activity.trades.map(t => t.timestamp).sort((a, b) => a - b)
      const intervals: number[] = []
      for (let i = 1; i < Math.min(timestamps.length, 30); i++) {
        intervals.push(timestamps[i] - timestamps[i - 1])
      }
      
      if (intervals.length > 10) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
        const stdDev = Math.sqrt(variance)
        
        // VERY strict threshold - only penalize obvious bots
        if (stdDev / avgInterval < 0.05 && avgInterval < 1800000) { // 30min
          score -= 18
          factors.push(`🚨 Robotic timing detected`)
        }
      }
    }

    // Bonus points for human traits (MORE GENEROUS!)
    if (trader.verified) {
      score += 5
      factors.push(`✓ Verified trader`)
    }
    
    if (trader.xUsername) {
      score += 3
      factors.push(`✓ Social presence`)
    }

    if (activity.activeDays > 30) {
      score += 3
      factors.push(`✓ Established account`)
    }

    if (uniqueMarkets >= 10) {
      score += 2
      factors.push(`✓ Diverse portfolio`)
    }

    if (activity.totalTrades > 100) {
      score += 2
      factors.push(`✓ Experienced trader`)
    }

    // Cap score between 0-100
    score = Math.max(0, Math.min(100, score))

    // Determine status (More generous thresholds!)
    let status: 'REAL_HUMAN' | 'SUSPICIOUS' | 'BOT_DETECTED'
    if (score >= 80) {
      status = 'REAL_HUMAN'
    } else if (score >= 50) {
      status = 'SUSPICIOUS'
    } else {
      status = 'BOT_DETECTED'
    }

    return { score, status, factors }
  }

  // Run Bot Scan with COSMIC animation! 🚀
  const runBotScan = async () => {
    setIsScanning(true)
    setShowScanResult(false)
    
    // Cosmic scanning animation (3 seconds for dramatic effect!)
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Calculate score
    const result = calculateBotScore()
    setScanResult(result)
    setIsScanning(false)
    
    // Show result after a brief delay
    setTimeout(() => {
      setShowScanResult(true)
    }, 500)
  }

  useEffect(() => {
    fetchTraderData()
  }, [address])

  const fetchTraderData = async () => {
    try {
      setLoading(true)

      // Try to fetch trader directly from database by address
      const traderRes = await fetch(`/api/trader/${address}`)
      
      if (traderRes.ok) {
        const foundTrader: Trader = await traderRes.json()
        console.log('👤 Trader data received:', {
          address: foundTrader.address,
          displayName: foundTrader.displayName,
          winRate: foundTrader.winRate,
          tier: foundTrader.tier
        })
        setTrader(foundTrader)
        
        // Fetch activity (includes trades) from Railway API
        const activityRes = await fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
        
        if (activityRes.ok) {
          const activityData = await activityRes.json()
          console.log('📥 Activity data received:', {
            lastTrade: activityData.lastTrade,
            totalTrades: activityData.totalTrades,
            categoryBreakdown: activityData.categoryBreakdown,
            finishedTrades: activityData.trades?.length || 0
          })

            // ✅ Primary source: finished trades from backend (most accurate)
            const finishedTrades = Array.isArray(activityData.trades) ? activityData.trades : []
            if (finishedTrades.length > 0) {
              let wins = 0
              let losses = 0
              for (const trade of finishedTrades) {
                const profit = parseFloat(trade.profit || '0')
                if (profit > 0) wins++
                else if (profit < 0) losses++
              }

              const total = wins + losses
              if (total > 0) {
                const overallWinRate = wins / total
                foundTrader.winRate = overallWinRate
                console.log(`✅ OVERALL WIN RATE (BACKEND TRADES): ${(overallWinRate * 100).toFixed(1)}% (${wins}W / ${losses}L from ${total} finished trades)`)
              }
            } else {
              console.log('⚠️ No finished trades from backend - using Polymarket fallback')
            }
          
          // FRONTEND FALLBACK: Fetch TRADES + POSITIONS DIRECTLY from Polymarket! 🚀
          if (finishedTrades.length === 0) {
            try {
            console.log('🔍 Fetching trades from Polymarket (checking for losses)...')
            
            // TRY BOTH: closed-positions AND trades to compare!
            const [closedRes, tradesRes, positionsRes] = await Promise.all([
              fetch(`https://data-api.polymarket.com/closed-positions?user=${address}&limit=1000`),
              fetch(`https://data-api.polymarket.com/v1/trades?trader=${address}&limit=1000`),
              fetch(`https://data-api.polymarket.com/positions?user=${address}`)
            ])
            
            let closedPositions: any[] = []
            let allTrades: any[] = []
            let positionsList: any[] = []
            
            if (closedRes.ok) {
              closedPositions = await closedRes.json() as any[]
              console.log(`📊 CLOSED POSITIONS: ${closedPositions.length} fetched`)
              
              // DEBUG: Show PnL distribution from closed positions
              const closedPnlDist = {
                profitable: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') > 0).length,
                unprofitable: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') < 0).length,
                breakEven: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') === 0).length,
                zeroOrNull: closedPositions.filter(p => !p.realizedPnl || p.realizedPnl === '0').length
              }
              console.log('💰 Closed Positions PnL Distribution:', closedPnlDist)
              
              // Show first 3 positions with their PnL
              console.log('📍 First 3 closed positions PnL values:')
              closedPositions.slice(0, 3).forEach((p, i) => {
                console.log(`  #${i + 1}: realizedPnl = "${p.realizedPnl}" (parsed: ${parseFloat(p.realizedPnl || '0')})`)
              })
            }
            
            if (tradesRes.ok) {
              const tradesData = await tradesRes.json() as any
              allTrades = tradesData.trades || tradesData || []
              console.log(`📊 TRADES: ${allTrades.length} fetched`)
              
              // DEBUG: Show first trade structure
              if (allTrades.length > 0) {
                console.log('📍 FIRST TRADE (full structure):', JSON.stringify(allTrades[0], null, 2))
              }
              
              // Show trades distribution
              const tradesDist = {
                BUY: allTrades.filter(t => t.side === 'BUY').length,
                SELL: allTrades.filter(t => t.side === 'SELL').length
              }
              console.log('💰 Trades Distribution:', tradesDist)
              
              // Show field names
              if (allTrades.length > 0) {
                const firstTrade = allTrades[0]
                console.log('🔑 Trade fields:', Object.keys(firstTrade))
                console.log('📍 Sample values:', {
                  market: firstTrade.market || firstTrade.asset_id || firstTrade.token_id || firstTrade.id,
                  side: firstTrade.side,
                  size: firstTrade.size || firstTrade.amount,
                  price: firstTrade.price,
                  title: firstTrade.title || firstTrade.question
                })
              }
            }
            
            if (positionsRes.ok) {
              const positionsData = await positionsRes.json() as any
              positionsList = positionsData.positions || positionsData || []
              console.log(`📊 POSITIONS: ${positionsList.length} fetched`)
              
              if (positionsList.length > 0) {
                console.log('📍 FIRST POSITION (full structure):', JSON.stringify(positionsList[0], null, 2))
              }
            }
            
            // Use closed positions if available, otherwise fall back to trades
            const dataSource = closedPositions.length > 0 ? 'closed-positions' : 'trades'
            console.log(`🎯 Using data source: ${dataSource}`)
            
            if (closedPositions.length === 0 && allTrades.length === 0) {
              console.log('⚠️ No data from either API!')
            }
            const detectCategory = (title: string): string => {
              const t = title.toLowerCase()
              
              // CRYPTO (most specific first)
              if (t.includes('bitcoin') || t.includes('btc') || t.includes('ethereum') || 
                  t.includes('eth') || t.includes('crypto') || t.includes('solana') ||
                  t.includes('doge') || t.includes('cardano') || t.includes('polygon') ||
                  t.includes('xrp') || t.includes('bnb') || t.includes('avax')) return 'Crypto'
              
              // POLITICS
              if (t.includes('trump') || t.includes('biden') || t.includes('election') ||
                  t.includes('president') || t.includes('congress') || t.includes('senate') ||
                  t.includes('governor') || t.includes('vote') || t.includes('republican') ||
                  t.includes('democrat') || t.includes('harris') || t.includes('desantis')) return 'Politics'
              
              // SPORTS
              if (t.includes('nfl') || t.includes('nba') || t.includes('football') || 
                  t.includes('basketball') || t.includes('soccer') || t.includes('mlb') ||
                  t.includes('nhl') || t.includes('ufc') || t.includes('f1') || 
                  t.includes('tennis') || t.includes('boxing') || t.includes('champions league')) return 'Sports'
              
              // CULTURE
              if (t.includes('movie') || t.includes('oscars') || t.includes('grammy') ||
                  t.includes('emmy') || t.includes('taylor swift') || t.includes('kanye') ||
                  t.includes('kardashian') || t.includes('netflix') || t.includes('spotify')) return 'Culture'
              
              return 'Other'
            }

            const toNumber = (value: any) => {
              const num = parseFloat(value)
              return Number.isFinite(num) ? num : 0
            }
            
            // Prefer POSITIONS for win rate (includes open + negative PnL)
            if (positionsList.length > 0) {
              console.log('🎯 Using POSITIONS to calculate Win Rate (includes open PnL)')
              
              const categoryWinRate = new Map<string, { wins: number; losses: number }>()
              const categoryPnL = new Map<string, { pnl: number; volume: number }>()
              
              let totalWins = 0
              let totalLosses = 0
              let breakEven = 0
              
              for (const pos of positionsList) {
                const title = pos.title || pos.question || pos.marketTitle || pos.eventTitle || ''
                const category = detectCategory(title)
                const initialValue = toNumber(pos.initialValue || pos.totalBought || pos.total_buy || pos.cost)
                const avgPrice = toNumber(pos.avgPrice || pos.avg_price || pos.price)
                const size = toNumber(pos.size || pos.quantity || pos.shares)
                const currentValue = toNumber(pos.currentValue || pos.current_value)
                
                let pnl = toNumber(pos.cashPnl || pos.realizedPnl || pos.pnl || pos.unrealizedPnl)
                if (!pnl && currentValue && initialValue) {
                  pnl = currentValue - initialValue
                }
                
                const volume = initialValue || (avgPrice && size ? avgPrice * size : 0)
                
                if (!categoryWinRate.has(category)) {
                  categoryWinRate.set(category, { wins: 0, losses: 0 })
                }
                if (!categoryPnL.has(category)) {
                  categoryPnL.set(category, { pnl: 0, volume: 0 })
                }
                
                const winLoss = categoryWinRate.get(category)!
                const pnlData = categoryPnL.get(category)!
                pnlData.pnl += pnl
                pnlData.volume += volume
                
                if (pnl > 0) {
                  winLoss.wins++
                  totalWins++
                } else if (pnl < 0) {
                  winLoss.losses++
                  totalLosses++
                } else {
                  breakEven++
                }
              }
              
              console.log('🎯 Win/Loss stats (from positions):', Object.fromEntries(categoryWinRate))
              console.log(`📊 TOTAL: ${totalWins} wins, ${totalLosses} losses, ${breakEven} break-even`)
              
              const totalTrades = totalWins + totalLosses
              let overallWinRate = foundTrader.winRate || 0.5
              
              if (totalTrades >= 10) {
                overallWinRate = totalWins / totalTrades
                console.log(`✅ OVERALL WIN RATE (REAL from positions): ${(overallWinRate * 100).toFixed(1)}% (${totalWins}W / ${totalLosses}L from ${totalTrades} positions)`)
              } else if (totalTrades > 0) {
                const realWinRate = totalWins / totalTrades
                const backendWinRate = foundTrader.winRate || 0.5
                overallWinRate = (realWinRate * 0.7) + (backendWinRate * 0.3)
                console.log(`⚠️ OVERALL WIN RATE (MIXED from positions): ${(overallWinRate * 100).toFixed(1)}% (only ${totalTrades} positions)`)
              } else {
                console.log(`⚠️ OVERALL WIN RATE (BACKEND): ${(overallWinRate * 100).toFixed(1)}% (no positions with PnL found)`)
              }
              
              foundTrader.winRate = overallWinRate
              
              const allCategories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
              const enhancedBreakdown = allCategories.map(cat => {
                const existing = activityData.categoryBreakdown.find((c: any) => c.category === cat)
                const closedData = categoryPnL.get(cat)
                const winLossData = categoryWinRate.get(cat)
                const categoryTrades = (winLossData?.wins || 0) + (winLossData?.losses || 0)
                
                let realWinRate = existing?.winRate || 0
                if (categoryTrades >= 5) {
                  realWinRate = (winLossData!.wins / categoryTrades) * 100
                } else if (categoryTrades > 0) {
                  const categoryRealWinRate = (winLossData!.wins / categoryTrades) * 100
                  const fallbackWinRate = existing?.winRate || (overallWinRate * 100)
                  realWinRate = (categoryRealWinRate * 0.6) + (fallbackWinRate * 0.4)
                } else {
                  realWinRate = (overallWinRate * 100)
                }
                
                if (closedData && closedData.volume > 0) {
                  const roi = (closedData.pnl / closedData.volume) * 100
                  const avgProfit = closedData.pnl / Math.max(categoryTrades, 1)
                  const biggestWin = closedData.pnl > 0 ? closedData.pnl * 0.25 : 0
                  const consistency = realWinRate > 0 ? Math.min(realWinRate, 85) : 0
                  
                  return {
                    ...(existing || { category: cat, count: 0, volume: 0, percentage: 0 }),
                    roi,
                    totalProfit: closedData.pnl,
                    avgProfit,
                    biggestWin,
                    winRate: realWinRate,
                    consistency,
                    finishedTradesCount: categoryTrades
                  }
                }
                
                return existing || {
                  category: cat,
                  count: 0,
                  volume: 0,
                  percentage: 0,
                  roi: 0,
                  totalProfit: 0,
                  avgProfit: 0,
                  biggestWin: 0,
                  winRate: realWinRate,
                  consistency: 0,
                  finishedTradesCount: 0
                }
              })
              
              activityData.categoryBreakdown = enhancedBreakdown
              console.log('✅ Enhanced categoryBreakdown with Win Rate from positions!')
            // CRITICAL: closed-positions API only returns PROFITABLE! Use trades instead!
            } else if (allTrades.length > 0) {
              console.log('🎯 Using TRADES to calculate REAL Win Rate (closed-positions filters losses!)')
              
              // Calculate Win Rate from trades by matching BUY/SELL
              interface TradeMatch {
                market: string
                title: string
                category: string
                buyPrice: number
                sellPrice: number
                size: number
                profit: number
              }
              
              const matchedTrades: TradeMatch[] = []
              const tradesByMarket = new Map<string, { buys: any[], sells: any[] }>()
              
              // Group trades by market
              let skippedNoMarketId = 0
              let skippedNoSide = 0
              
              for (const trade of allTrades) {
                // Polymarket trades API uses 'asset' field for market ID!
                const marketId = trade.asset || trade.market || trade.asset_id || trade.token_id
                if (!marketId) {
                  skippedNoMarketId++
                  if (skippedNoMarketId <= 3) {
                    console.log(`⚠️ Trade without marketId:`, trade)
                  }
                  continue
                }
                
                if (!trade.side) {
                  skippedNoSide++
                  if (skippedNoSide <= 3) {
                    console.log(`⚠️ Trade without side:`, trade)
                  }
                  continue
                }
                
                if (!tradesByMarket.has(marketId)) {
                  tradesByMarket.set(marketId, { buys: [], sells: [] })
                }
                
                const group = tradesByMarket.get(marketId)!
                if (trade.side === 'BUY') {
                  group.buys.push(trade)
                } else if (trade.side === 'SELL') {
                  group.sells.push(trade)
                }
              }
              
              console.log(`📊 Grouped trades: ${tradesByMarket.size} markets`)
              console.log(`⚠️ Skipped: ${skippedNoMarketId} no marketId, ${skippedNoSide} no side`)
              
              // Show first 3 markets
              let marketCount = 0
              for (const [marketId, { buys, sells }] of tradesByMarket) {
                if (marketCount++ < 3) {
                  console.log(`  Market ${marketId.substring(0, 20)}...: ${buys.length} BUY, ${sells.length} SELL`)
                }
              }
              
              // Match BUY/SELL using FIFO
              for (const [marketId, { buys, sells }] of tradesByMarket) {
                // Sort by timestamp (Polymarket uses 't' field for timestamp)
                buys.sort((a, b) => (a.t || a.timestamp || a.created_at || 0) - (b.t || b.timestamp || b.created_at || 0))
                sells.sort((a, b) => (a.t || a.timestamp || a.created_at || 0) - (b.t || b.timestamp || b.created_at || 0))
                
                let buyIdx = 0
                let sellIdx = 0
                let buyRemaining = 0
                
                while (buyIdx < buys.length && sellIdx < sells.length) {
                  const buy = buys[buyIdx]
                  const sell = sells[sellIdx]
                  
                  // Polymarket uses 'size' field for amount
                  const buySize = parseFloat(buy.size || buy.amount || '0')
                  const sellSize = parseFloat(sell.size || sell.amount || '0')
                  const buyPrice = parseFloat(buy.price || '0')
                  const sellPrice = parseFloat(sell.price || '0')
                  
                  if (buyRemaining === 0) {
                    buyRemaining = buySize
                  }
                  
                  const matchSize = Math.min(buyRemaining, sellSize)
                  const profit = (sellPrice - buyPrice) * matchSize
                  
                  matchedTrades.push({
                    market: marketId,
                    title: buy.title || sell.title || 'Unknown',
                    category: detectCategory(buy.title || sell.title || ''),
                    buyPrice,
                    sellPrice,
                    size: matchSize,
                    profit
                  })
                  
                  buyRemaining -= matchSize
                  
                  if (buyRemaining <= 0) {
                    buyIdx++
                    buyRemaining = 0
                  }
                  
                  if (matchSize >= sellSize) {
                    sellIdx++
                  }
                }
              }
              
              console.log(`🎯 Matched ${matchedTrades.length} BUY/SELL pairs (finished trades)`)
              
              // Show first 5 matched trades
              console.log('📍 First 5 matched trades:')
              matchedTrades.slice(0, 5).forEach((t, i) => {
                console.log(`  #${i + 1}: ${t.title.substring(0, 40)} | Buy $${t.buyPrice.toFixed(3)} → Sell $${t.sellPrice.toFixed(3)} | PnL: $${t.profit.toFixed(2)} ${t.profit > 0 ? '✅' : '❌'}`)
              })
              
              // Calculate Win Rate from matched trades
              const categoryWinRate = new Map<string, { wins: number; losses: number }>()
              const categoryPnL = new Map<string, { pnl: number; volume: number }>()
              
              let totalWins = 0
              let totalLosses = 0
              let breakEven = 0
              
              for (const trade of matchedTrades) {
                const cat = trade.category
                
                if (!categoryWinRate.has(cat)) {
                  categoryWinRate.set(cat, { wins: 0, losses: 0 })
                }
                if (!categoryPnL.has(cat)) {
                  categoryPnL.set(cat, { pnl: 0, volume: 0 })
                }
                
                const winLoss = categoryWinRate.get(cat)!
                const pnl = categoryPnL.get(cat)!
                
                pnl.pnl += trade.profit
                pnl.volume += trade.buyPrice * trade.size
                
                if (trade.profit > 0) {
                  winLoss.wins++
                  totalWins++
                } else if (trade.profit < 0) {
                  winLoss.losses++
                  totalLosses++
                } else {
                  breakEven++
                }
              }
              
              console.log('🎯 Win/Loss stats (from matched trades):', Object.fromEntries(categoryWinRate))
              console.log(`📊 TOTAL: ${totalWins} wins, ${totalLosses} losses, ${breakEven} break-even`)
              
              // Calculate OVERALL win rate from matched trades
              const totalTrades = totalWins + totalLosses
              let overallWinRate = foundTrader.winRate || 0.5 // Default fallback
              
              if (totalTrades >= 10) {
                // Use REAL win rate if we have enough data (10+ trades)
                overallWinRate = totalWins / totalTrades
                console.log(`✅ OVERALL WIN RATE (REAL from trades): ${(overallWinRate * 100).toFixed(1)}% (${totalWins}W / ${totalLosses}L from ${totalTrades} trades)`)
              } else if (totalTrades > 0) {
                // Mix real data with backend estimate if < 10 trades
                const realWinRate = totalWins / totalTrades
                const backendWinRate = foundTrader.winRate || 0.5
                overallWinRate = (realWinRate * 0.7) + (backendWinRate * 0.3) // 70% real, 30% estimate
                console.log(`⚠️ OVERALL WIN RATE (MIXED from trades): ${(overallWinRate * 100).toFixed(1)}% (only ${totalTrades} trades, mixing real ${(realWinRate * 100).toFixed(1)}% with backend ${(backendWinRate * 100).toFixed(1)}%)`)
              } else {
                // Use backend estimate if no matched trades
                console.log(`⚠️ OVERALL WIN RATE (BACKEND): ${(overallWinRate * 100).toFixed(1)}% (no matched trades found)`)
              }
              
              // Update trader with REAL win rate!
              foundTrader.winRate = overallWinRate
              
              // Update categoryBreakdown with REAL ROI and Win Rate from matched trades!
              const allCategories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
              const enhancedBreakdown = allCategories.map(cat => {
                const existing = activityData.categoryBreakdown.find((c: any) => c.category === cat)
                const closedData = categoryPnL.get(cat)
                const winLossData = categoryWinRate.get(cat)
                
                // Calculate REAL win rate from closed positions with smart fallback
                let realWinRate = existing?.winRate || 0
                const categoryTrades = (winLossData?.wins || 0) + (winLossData?.losses || 0)
                
                if (categoryTrades >= 5) {
                  // Use REAL win rate if we have enough data (5+ trades per category)
                  realWinRate = (winLossData!.wins / categoryTrades) * 100
                  console.log(`  ${cat}: REAL Win Rate ${realWinRate.toFixed(1)}% (${winLossData!.wins}W / ${winLossData!.losses}L from ${categoryTrades} trades)`)
                } else if (categoryTrades > 0) {
                  // Mix real data with backend/overall estimate if < 5 trades
                  const categoryRealWinRate = (winLossData!.wins / categoryTrades) * 100
                  const fallbackWinRate = existing?.winRate || (overallWinRate * 100)
                  realWinRate = (categoryRealWinRate * 0.6) + (fallbackWinRate * 0.4) // 60% real, 40% estimate
                  console.log(`  ${cat}: MIXED Win Rate ${realWinRate.toFixed(1)}% (only ${categoryTrades} trades, mixing real ${categoryRealWinRate.toFixed(1)}% with fallback ${fallbackWinRate.toFixed(1)}%)`)
                } else {
                  // Use overall win rate as fallback if no trades in this category
                  realWinRate = (overallWinRate * 100)
                  console.log(`  ${cat}: FALLBACK Win Rate ${realWinRate.toFixed(1)}% (no trades in this category)`)
                }
                
                if (closedData && closedData.volume > 0) {
                  const roi = (closedData.pnl / closedData.volume) * 100
                  const avgProfit = closedData.pnl / ((winLossData?.wins || 1) + (winLossData?.losses || 1))
                  const biggestWin = closedData.pnl > 0 ? closedData.pnl * 0.25 : 0
                  const consistency = realWinRate > 0 ? Math.min(realWinRate, 85) : 0
                  
                  console.log(`  ${cat}: ROI ${roi.toFixed(2)}%, Win Rate ${realWinRate.toFixed(1)}%, PnL $${closedData.pnl.toFixed(2)}`)
                  
                  return {
                    ...(existing || { category: cat, count: 0, volume: 0, percentage: 0 }),
                    roi,
                    totalProfit: closedData.pnl,
                    avgProfit,
                    biggestWin,
                    winRate: realWinRate,
                    consistency,
                    finishedTradesCount: (winLossData?.wins || 0) + (winLossData?.losses || 0)
                  }
                }
                
                return existing || {
                  category: cat,
                  count: 0,
                  volume: 0,
                  percentage: 0,
                  roi: 0,
                  totalProfit: 0,
                  avgProfit: 0,
                  biggestWin: 0,
                  winRate: 0,
                  consistency: 0,
                  finishedTradesCount: 0
                }
              })
              
              activityData.categoryBreakdown = enhancedBreakdown
              console.log('✅ Enhanced categoryBreakdown with REAL Win Rate from matched trades!')
            } else {
              console.log('⚠️ No trades found - using backend data only (may have biased win rates)')
            }
            } catch (err) {
              console.error('❌ Failed to fetch data from Polymarket:', err)
            }
          }
          
          // Update trader with new winRate BEFORE setting state
          setTrader(foundTrader)
          setActivity(activityData)
        } else {
          console.error('❌ Failed to fetch activity:', activityRes.status)
        }
        
        return
      }
      
      // Fallback: try to find in monthly leaderboard (top 1000)
      const tradersRes = await fetch('/api/traders')
      const allTraders: Trader[] = await tradersRes.json()
      
      const foundTrader = allTraders.find(t => t.address.toLowerCase() === address.toLowerCase())
      
      if (!foundTrader) {
        console.error('Trader not found in database or leaderboard')
        return
      }

      setTrader(foundTrader)
      
      // Fetch activity for leaderboard traders too
      const activityRes = await fetch(`${API_BASE_URL}/api/trader/${address}/activity`)
      
      if (activityRes.ok) {
        const activityData = await activityRes.json()
        setActivity(activityData)
      }
      
    } catch (error) {
      console.error('Failed to fetch trader data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate radar chart data for Most Traded Categories (count)
  const getMostTradedCategories = () => {
    if (!activity?.categoryBreakdown) {
      console.log('🔴 No categoryBreakdown data!')
      return []
    }
    
    console.log('📊 categoryBreakdown:', activity.categoryBreakdown)
    
    const categories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
    const dataMap = new Map(activity.categoryBreakdown.map(c => [c.category, c.count]))
    
    // Add minimum value for better visualization if category has data
    const result = categories.map(cat => {
      const count = dataMap.get(cat) || 0
      // If has data but very small, boost it for visibility
      const boostedValue = count > 0 && count < 5 ? Math.max(count, 3) : count
      return {
        category: cat,
        value: boostedValue
      }
    })
    
    console.log('🔵 Most Traded Categories data:', result)
    return result
  }

  // Calculate ROI by Category (Return on Investment %)
  const getROIByCategory = () => {
    if (!activity?.categoryBreakdown) {
      console.log('🔴 No categoryBreakdown data!')
      return []
    }
    
    const categories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
    const dataMap = new Map(activity.categoryBreakdown.map(c => [c.category, c.roi]))
    
    // ROI can be negative, so handle that
    const result = categories.map(cat => {
      const roi = dataMap.get(cat) || 0
      // Boost small positive ROI for visibility, but keep negatives as-is
      const boostedValue = roi > 0 && roi < 5 ? Math.max(roi, 5) : (roi < 0 ? Math.max(roi, -100) : roi)
      return {
        category: cat,
        value: Math.round(boostedValue * 10) / 10, // Round to 1 decimal
        isNegative: roi < 0
      }
    })
    
    console.log('🟢 ROI by Category data:', result)
    return result
  }

  // Calculate Win Rate by Category (percentage) - NOW USES BACKEND DATA! 🚀
  const getWinRateByCategory = () => {
    console.log('🟠 Win Rate calculation started')
    
    if (!activity?.categoryBreakdown) {
      console.log('🔴 No categoryBreakdown - returning empty')
      return []
    }
    
    const categories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
    // Use backend-calculated winRate directly!
    const dataMap = new Map(activity.categoryBreakdown.map(c => [c.category, {
      winRate: c.winRate,
      consistency: c.consistency,
      finishedTrades: c.finishedTradesCount
    }]))
    
    console.log('   Backend data:', Object.fromEntries(dataMap))
    
    const result = categories.map(cat => {
      const data = dataMap.get(cat)
      
      if (data && data.finishedTrades > 0) {
        // Use backend-calculated win rate!
        console.log(`   ${cat}: ${data.winRate.toFixed(1)}% (${data.finishedTrades} finished trades, consistency: ${data.consistency.toFixed(1)})`)
        return {
          category: cat,
          value: data.winRate,
          consistency: data.consistency,
          finishedTrades: data.finishedTrades
        }
      }
      
      // Fallback for categories with trades but no finished trades
      const categoryData = activity.categoryBreakdown.find(c => c.category === cat)
      if (categoryData && categoryData.count > 0) {
        // Use trader's overall win rate as estimate
        let estimatedWinRate = 50
        if (trader?.winRate) {
          const rawWinRate = parseFloat(trader.winRate.toString())
          estimatedWinRate = rawWinRate <= 1 ? rawWinRate * 100 : rawWinRate
        }
        console.log(`   ${cat}: ${estimatedWinRate.toFixed(1)}% (estimated, ${categoryData.count} trades)`)
        return {
          category: cat,
          value: Math.max(20, estimatedWinRate),
          consistency: 0,
          finishedTrades: 0
        }
      }
      
      console.log(`   ${cat}: 0% (no trades)`)
      return {
        category: cat,
        value: 0,
        consistency: 0,
        finishedTrades: 0
      }
    })
    
    console.log('🟠 Final Win Rate data:', result)
    return result
  }

  // Get finished trades for bubble chart
  const getFinishedTrades = () => {
    if (!activity?.trades) return []
    
    return activity.trades
      .filter(t => t.profit !== undefined)
      .map(t => ({
        buyPrice: t.buyPrice * 100, // Convert to cents (0-100)
        sellPrice: t.sellPrice * 100, // Convert to cents (0-100)
        profit: t.profit || 0,
        size: Math.max(50, Math.abs(t.profit || 0)), // Bubble size (min 50 for visibility)
        category: t.category
      }))
      .slice(0, 50) // Show last 50 finished trades
  }

  // Calculate optimal domain for radar charts (with padding)
  const getRadarDomain = (data: any[], padding: number = 1.2) => {
    if (!data || data.length === 0) return [0, 100]
    const maxValue = Math.max(...data.map(d => d.value || 0))
    if (maxValue === 0) return [0, 100]
    // Add padding to max value (20% by default) for better visualization
    const domainMax = Math.ceil(maxValue * padding)
    return [0, domainMax]
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-white">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-primary font-bold">&gt; LOADING_TRADER_PROFILE...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!trader) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-white">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">TRADER_NOT_FOUND</p>
          <Link href="/traders" className="text-primary hover:text-primary/80">
            &lt; BACK_TO_TRADERS
          </Link>
        </div>
      </div>
    )
  }

  const tierColor = {
    S: '#FFD700',
    A: '#00ff00',
    B: '#00aaff',
    C: '#ffffff',
    D: '#888888',
    E: '#444444'
  }[trader.tier] || '#ffffff'

  // Generate WHY TIER explanation
  const generateTierExplanation = (): string[] => {
    const reasons: string[] = []
    
    if (trader.tier === 'S') {
      // Check if public figure
      if (trader.xUsername || trader.verified) {
        reasons.push(`✓ PUBLIC_FIGURE: Verified trader with Twitter presence (@${trader.xUsername || 'verified'})`)
      }
      
      // High PnL
      if (trader.estimatedPnL > 50000) {
        reasons.push(`✓ ELITE_PROFITS: ${formatCurrency(trader.estimatedPnL)}+ total PnL (top 0.1%)`)
      }
      
      // High Volume (experience)
      if (trader.volume > 500000) {
        reasons.push(`✓ HIGH_VOLUME: ${formatCurrency(trader.volume)}+ traded (experienced trader)`)
      }
      
      // Win Rate
      if (trader.winRate > 0.55) {
        reasons.push(`✓ WINNING_EDGE: ${(trader.winRate * 100).toFixed(1)}% win rate (consistent profitability)`)
      }
      
      // High Score
      if (trader.rarityScore > 60000) {
        const scoreDisplay = trader.rarityScore >= 1000 
          ? `${(trader.rarityScore / 1000).toFixed(1)}K` 
          : trader.rarityScore.toString()
        reasons.push(`✓ TOP_PERFORMER: Rarity score ${scoreDisplay}+ (elite tier)`)
      }
    } else if (trader.tier === 'A') {
      reasons.push(`✓ Strong PnL: ${formatCurrency(trader.estimatedPnL)} monthly profit`)
      reasons.push(`✓ Active trader: ${trader.tradeCount}+ trades with ${(trader.winRate * 100).toFixed(1)}% win rate`)
      reasons.push(`✓ High volume: Proven track record with significant trading activity`)
    } else if (trader.tier === 'B') {
      reasons.push(`✓ Solid performance: Consistent profitable trading`)
      reasons.push(`✓ Growing portfolio: Building experience and volume`)
    }
    
    return reasons
  }

  const tierReasons = generateTierExplanation()

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-white">
      {/* Back Button */}
      <Link 
        href="/traders"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-bold">&lt; BACK_TO_TRADERS</span>
      </Link>

      {/* Header - Trader Info */}
      <div className="bg-card pixel-border border-primary/40 p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={trader.avatar}
              alt={trader.displayName}
              className="w-32 h-32 rounded-lg pixel-border object-cover"
              style={{ borderColor: tierColor, borderWidth: '3px' }}
              onError={(e) => {
                e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=default'
              }}
            />
            {/* Tier Badge */}
            <div 
              className="absolute -top-3 -right-3 w-12 h-12 pixel-border flex items-center justify-center text-black font-bold text-xl"
              style={{ backgroundColor: tierColor }}
            >
              {trader.tier}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{trader.displayName}</h1>
              {trader.verified && (
                <span className="text-primary text-xl">✓</span>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm mb-4 font-mono">
              {trader.address.slice(0, 10)}...{trader.address.slice(-8)}
            </p>

            {trader.xUsername && (
              <a
                href={`https://twitter.com/${trader.xUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm mb-4"
              >
                <span>𝕏 @{trader.xUsername}</span>
              </a>
            )}

            {/* Quick Stats */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: tierColor }} />
                <span className="text-sm">
                  SCORE: <span className="font-bold">
                    {trader.rarityScore >= 1000 
                      ? `${(trader.rarityScore / 1000).toFixed(1)}K` 
                      : trader.rarityScore.toFixed(0)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm">
                  TRADES: <span className="font-bold">{trader.tradeCount}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Polymarket Button (moved up!) - NEON PURPLE! */}
          <div className="flex-shrink-0">
            <a
              href={`https://polymarket.com/profile/${trader.address}?via=01k`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-2 px-6 py-3 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7c3aed 100%)',
                boxShadow: '0 0 30px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(196, 181, 253, 0.4)',
                borderRadius: '10px',
                transform: 'translateZ(0)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05) translateZ(0)'
                e.currentTarget.style.boxShadow = '0 0 50px rgba(168, 85, 247, 0.8), 0 0 100px rgba(168, 85, 247, 0.4), inset 0 0 25px rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateZ(0)'
                e.currentTarget.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2), inset 0 0 15px rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Animated border gradient */}
              <div className="absolute inset-0 opacity-40" style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                animation: 'borderFlow 3s linear infinite'
              }} />

              <svg className="h-5 w-5 relative z-10 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" style={{
                filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))'
              }}>
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z"/>
              </svg>
              <div className="text-left relative z-10">
                <div className="text-[10px] uppercase tracking-wider font-bold" style={{ 
                  textShadow: '0 0 8px rgba(255, 255, 255, 0.7)' 
                }}>
                  View on
                </div>
                <div className="text-sm font-black leading-tight" style={{ 
                  textShadow: '0 0 12px rgba(255, 255, 255, 0.9)' 
                }}>
                  POLYMARKET
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Action Buttons Row - BUBBLES + BOT SCAN (horizontal!) 🎮 */}
        <div className="flex gap-4 mt-6">
          {/* View Bubbles Button - NEON GREEN! */}
          <Link
            href={`/traders/${trader.address}/bubbles`}
            className="group relative flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #10b981 50%, #059669 100%)',
              boxShadow: '0 0 40px rgba(34, 197, 94, 0.6), 0 0 80px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
              border: '3px solid rgba(134, 239, 172, 0.5)',
              borderRadius: '12px',
              transform: 'translateZ(0)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05) rotate(1deg) translateZ(0)'
              e.currentTarget.style.boxShadow = '0 0 60px rgba(34, 197, 94, 0.9), 0 0 120px rgba(34, 197, 94, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg) translateZ(0)'
              e.currentTarget.style.boxShadow = '0 0 40px rgba(34, 197, 94, 0.6), 0 0 80px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Animated border gradient */}
            <div className="absolute inset-0 opacity-50" style={{
              background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
              animation: 'borderFlow 3s linear infinite'
            }} />
            
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-xl" style={{
              border: '2px solid rgba(134, 239, 172, 0.6)',
              animation: 'pulseRing 2s ease-out infinite'
            }} />

            <span className="text-3xl relative z-10 group-hover:scale-110 transition-transform">🫧</span>
            <div className="text-left relative z-10">
              <div className="text-xs uppercase tracking-wider font-bold" style={{ 
                textShadow: '0 0 10px rgba(255, 255, 255, 0.8)' 
              }}>
                View Position
      </div>
              <div className="text-lg font-black" style={{ 
                textShadow: '0 0 15px rgba(255, 255, 255, 1)' 
              }}>
                BUBBLES
              </div>
            </div>
          </Link>

          {/* BOT SCAN Button - NEON CYAN! 🤖 */}
          <button
              onClick={runBotScan}
              disabled={isScanning}
              className="group relative flex-1 inline-flex items-center justify-center gap-3 px-8 py-4 overflow-hidden"
              style={{
                background: isScanning 
                  ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)'
                  : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
                boxShadow: '0 0 40px rgba(6, 182, 212, 0.6), 0 0 80px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                border: '3px solid rgba(103, 232, 249, 0.5)',
                borderRadius: '12px',
                transform: 'translateZ(0)',
                transition: 'all 0.3s ease',
                cursor: isScanning ? 'wait' : 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!isScanning) {
                  e.currentTarget.style.transform = 'scale(1.05) rotate(-1deg) translateZ(0)'
                  e.currentTarget.style.boxShadow = '0 0 60px rgba(6, 182, 212, 0.9), 0 0 120px rgba(6, 182, 212, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.2)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0deg) translateZ(0)'
                e.currentTarget.style.boxShadow = '0 0 40px rgba(6, 182, 212, 0.6), 0 0 80px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Scanning lines animation */}
              {isScanning && (
                <div className="absolute inset-0">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="absolute w-full h-0.5 bg-white/50"
                      style={{
                        animation: `scanMove 1.5s ease-in-out ${i * 0.5}s infinite`,
                        boxShadow: '0 0 10px rgba(255, 255, 255, 0.8)'
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Animated border gradient */}
              <div className="absolute inset-0 opacity-50" style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                animation: 'borderFlow 3s linear infinite reverse'
              }} />

              <span className={`text-3xl relative z-10 transition-transform ${isScanning ? 'animate-spin' : 'group-hover:scale-110'}`}>
                {isScanning ? '🔍' : '🤖'}
              </span>
              <div className="text-left relative z-10">
                <div className="text-xs uppercase tracking-wider font-bold" style={{ 
                  textShadow: '0 0 10px rgba(255, 255, 255, 0.8)' 
                }}>
                  {isScanning ? 'Scanning...' : 'Run'}
                </div>
                <div className="text-lg font-black" style={{ 
                  textShadow: '0 0 15px rgba(255, 255, 255, 1)' 
                }}>
                  {isScanning ? 'ANALYZING' : 'BOT SCAN'}
                </div>
              </div>
            </button>
          </div>
      </div>


      {/* COSMIC BOT SCAN ANIMATION! 🚀 */}
      {isScanning && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)',
              backgroundSize: '50px 50px',
              animation: 'gridScroll 2s linear infinite'
            }}
          />

          {/* Multiple scanning laser lines (MORE INTENSE!) */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <div
                key={`scan-${i}`}
                className="absolute w-full"
                style={{
                  height: i % 3 === 0 ? '3px' : '1px',
                  top: `${(i * 7) % 100}%`,
                  background: i % 3 === 0 
                    ? 'linear-gradient(90deg, transparent, #22d3ee 20%, #22d3ee 80%, transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6) 30%, rgba(34, 211, 238, 0.6) 70%, transparent)',
                  animation: `scanLine ${2 + (i % 3) * 0.5}s ease-in-out ${i * 0.15}s infinite`,
                  boxShadow: '0 0 30px rgba(34, 211, 238, 0.9), 0 0 60px rgba(34, 211, 238, 0.5)',
                  filter: 'blur(0.5px)'
                }}
              />
            ))}
          </div>

          {/* Scanning particles */}
          <div className="absolute inset-0">
            {[...Array(30)].map((_, i) => (
              <div
                key={`particle-${i}`}
                className="absolute w-1 h-1 bg-cyan-400 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  animation: `particleFall ${2 + Math.random() * 2}s linear ${Math.random()}s infinite`,
                  boxShadow: '0 0 6px rgba(34, 211, 238, 1)',
                  opacity: 0.8
                }}
              />
            ))}
          </div>

          {/* Center scanning indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              {/* Rotating rings */}
              {[0, 1, 2].map(ring => (
                <div
                  key={`ring-${ring}`}
                  className="absolute inset-0 border-2 border-cyan-400 rounded-full"
                  style={{
                    width: `${150 + ring * 50}px`,
                    height: `${150 + ring * 50}px`,
                    left: `${-(75 + ring * 25)}px`,
                    top: `${-(75 + ring * 25)}px`,
                    animation: `spin ${3 + ring}s linear infinite ${ring % 2 === 0 ? '' : 'reverse'}`,
                    opacity: 0.3 - ring * 0.1,
                    borderStyle: 'dashed'
                  }}
                />
              ))}
              
              {/* Center box */}
              <div className="bg-black/95 pixel-border border-cyan-400 p-8 backdrop-blur-md relative overflow-hidden">
                {/* Glitch effect overlay */}
                <div 
                  className="absolute inset-0 bg-cyan-400/10"
                  style={{ animation: 'glitch 0.3s infinite' }}
                />
                
                <div className="text-center relative z-10">
                  <div className="text-6xl mb-4 animate-pulse">🔍</div>
                  <h3 className="text-2xl font-bold text-cyan-400 mb-3" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.8)' }}>
                    SCANNING PROFILE...
                  </h3>
                  <div className="space-y-1 font-mono text-xs text-cyan-300">
                    <p className="animate-pulse">▸ Analyzing trade patterns...</p>
                    <p className="animate-pulse" style={{ animationDelay: '0.3s' }}>▸ Checking behavior...</p>
                    <p className="animate-pulse" style={{ animationDelay: '0.6s' }}>▸ Detecting anomalies...</p>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-4 w-full h-1 bg-black/50 pixel-border border-cyan-400/30 overflow-hidden">
                    <div 
                      className="h-full bg-cyan-400"
                      style={{ 
                        animation: 'progress 3s ease-in-out forwards',
                        boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes scanLine {
              0% {
                top: -5%;
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              90% {
                opacity: 1;
              }
              100% {
                top: 105%;
                opacity: 0;
              }
            }
            
            @keyframes particleFall {
              0% {
                top: -5%;
                opacity: 1;
              }
              100% {
                top: 105%;
                opacity: 0;
              }
            }
            
            @keyframes gridScroll {
              0% {
                transform: translateY(0);
              }
              100% {
                transform: translateY(50px);
              }
            }
            
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            
            @keyframes glitch {
              0%, 100% { opacity: 0; }
              50% { opacity: 1; }
            }
            
            @keyframes progress {
              0% { width: 0%; }
              100% { width: 100%; }
            }
          `}</style>
        </div>
      )}

      {/* BOT SCAN RESULTS - FLOATING RIGHT PANEL! 🎯 */}
      {showScanResult && scanResult && (
        <div 
          className="fixed right-6 top-24 z-50 w-96 animate-slideInRight"
          style={{
            animation: 'slideInRight 0.5s ease-out'
          }}
        >
          <div className={`pixel-border p-6 relative overflow-hidden backdrop-blur-md ${
            scanResult.status === 'REAL_HUMAN' 
              ? 'bg-green-950/95 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]' 
              : scanResult.status === 'SUSPICIOUS'
              ? 'bg-yellow-950/95 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.5)]'
              : 'bg-red-950/95 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
          }`}>
            {/* Glow effect */}
            <div className={`absolute inset-0 opacity-20 blur-xl ${
              scanResult.status === 'REAL_HUMAN' ? 'bg-green-400' : 
              scanResult.status === 'SUSPICIOUS' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />

            {/* Close Button */}
            <button
              onClick={() => setShowScanResult(false)}
              className="absolute top-3 right-3 text-white/60 hover:text-white text-xl transition-colors z-10"
            >
              ✕
            </button>

            {/* Content */}
            <div className="relative z-10">
              {/* Status Icon */}
              <div className="flex justify-center mb-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl animate-bounce ${
                  scanResult.status === 'REAL_HUMAN'
                    ? 'bg-green-500/20 border-4 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                    : scanResult.status === 'SUSPICIOUS'
                    ? 'bg-yellow-500/20 border-4 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.6)]'
                    : 'bg-red-500/20 border-4 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                }`}>
                  {scanResult.status === 'REAL_HUMAN' ? '✓' : scanResult.status === 'SUSPICIOUS' ? '⚠' : '✗'}
                </div>
              </div>

              {/* Status Text */}
              <h3 className={`text-xl font-bold mb-1 text-center ${
                scanResult.status === 'REAL_HUMAN' 
                  ? 'text-green-400' 
                  : scanResult.status === 'SUSPICIOUS'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`} style={{ textShadow: '0 0 10px currentColor' }}>
                {scanResult.status === 'REAL_HUMAN' 
                  ? 'HUMAN DETECTED' 
                  : scanResult.status === 'SUSPICIOUS'
                  ? 'SUSPICIOUS'
                  : 'BOT DETECTED'}
              </h3>

              {/* Score */}
              <div className="text-center mb-4">
                <div className={`text-5xl font-bold mb-3 ${
                  scanResult.score >= 80 ? 'text-green-400' : scanResult.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`} style={{ textShadow: '0 0 20px currentColor' }}>
                  {scanResult.score}%
                </div>
                
                {/* Score Bar */}
                <div className="w-full h-2 bg-black/50 pixel-border border-white/20 overflow-hidden mb-3">
                  <div 
                    className={`h-full ${
                      scanResult.score >= 80 ? 'bg-green-400' : scanResult.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ 
                      width: `${scanResult.score}%`,
                      animation: 'fillBar 1s ease-out',
                      boxShadow: '0 0 10px currentColor'
                    }}
                  />
                </div>

                <p className="text-xs text-white/60 uppercase tracking-wider">Confidence Score</p>
              </div>

              {/* Factors */}
              <div className="bg-black/30 pixel-border border-white/10 p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-white/60 mb-2 uppercase tracking-wider">Analysis:</p>
                <div className="space-y-1">
                  {scanResult.factors.slice(0, 6).map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className={factor.startsWith('✓') ? 'text-green-400' : factor.startsWith('⚠') || factor.startsWith('🚨') ? 'text-yellow-400' : 'text-cyan-400'}>
                        {factor.startsWith('✓') || factor.startsWith('⚠') || factor.startsWith('🚨') ? '' : '▸'}
                      </span>
                      <span className="text-white/90 font-mono leading-tight">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
            
            @keyframes fillBar {
              from { width: 0%; }
              to { width: ${scanResult.score}%; }
            }
          `}</style>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total PnL */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Total_PnL</p>
          </div>
          <p className={`text-2xl font-bold ${trader.estimatedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trader.estimatedPnL >= 0 ? '+' : ''}{formatCurrency(trader.estimatedPnL)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Monthly earnings</p>
        </div>

        {/* Total Trades */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Total_Trades</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {activity?.totalTrades || trader.tradeCount || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
        </div>

        {/* Volume */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase">Volume</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {activity && activity.categoryBreakdown.length > 0
              ? formatCurrency(activity.categoryBreakdown.reduce((sum, cat) => sum + cat.volume, 0))
              : formatCurrency(trader.volume || 0)
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activity && activity.categoryBreakdown.length > 0 ? 'Last 100 trades' : 'Estimated'}
          </p>
        </div>
      </div>

      {/* WHY TIER S/A/B? */}
      {tierReasons.length > 0 && (
        <div className="bg-card pixel-border p-6 mb-6" style={{ borderColor: tierColor, borderWidth: '2px' }}>
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-6 w-6" style={{ color: tierColor }} />
            <h2 className="text-2xl font-bold" style={{ color: tierColor }}>
              WHY_TIER_{trader.tier}?
            </h2>
          </div>
          
          <div className="space-y-3">
            {tierReasons.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <span className="text-primary font-bold text-lg flex-shrink-0">▸</span>
                <p className="text-white text-sm font-mono leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-muted-foreground font-mono">
              &gt; TIER_ANALYSIS_BASED_ON: Monthly PnL • Volume • Win Rate • Consistency • Public Profile
            </p>
          </div>
        </div>
      )}

      {/* Monthly Stats Summary */}
      <div className="bg-card pixel-border border-purple-500/40 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold text-purple-400">MONTHLY_PERFORMANCE</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">PnL This Month</p>
            <p className={`text-3xl font-bold ${trader.estimatedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trader.estimatedPnL >= 0 ? '+' : ''}{formatCurrency(trader.estimatedPnL)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">From Polymarket leaderboard</p>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Win Rate</p>
            <p className="text-3xl font-bold text-white">
              {(trader.winRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Based on last 1000 trades</p>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Total Trades</p>
            <p className="text-3xl font-bold text-primary">
              {trader.tradeCount || '~'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All-time activity</p>
          </div>
        </div>
      </div>

      {/* Trading Analytics - Performance Metrics */}
      {activity && activity.categoryBreakdown.length > 0 && (
        <div className="bg-card pixel-border border-purple-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-purple-400">TRADING_ANALYTICS</h2>
            <span className="text-muted-foreground text-xs">Performance Metrics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Most Traded Categories - Blue */}
            <div className="bg-black/40 pixel-border border-blue-500/20 p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="text-sm font-bold text-blue-400 text-center">Most Traded Categories</h3>
                  </div>
              <p className="text-xs text-center text-muted-foreground mb-3">Number of trades</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={getMostTradedCategories()}>
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#1e40af" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#1e3a8a" strokeOpacity={0.2} strokeWidth={1} />
                  <PolarAngleAxis 
                    dataKey="category" 
                    tick={{ fill: '#93c5fd', fontSize: 12, fontWeight: 600 }} 
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={getRadarDomain(getMostTradedCategories(), 1.3)} 
                    tick={{ fill: '#60a5fa', fontSize: 10 }} 
                    stroke="#1e40af"
                    strokeOpacity={0.3}
                  />
                  <Radar 
                    name="Trades" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    fill="url(#blueGradient)" 
                    fillOpacity={0.85} 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ fill: '#60a5fa', r: 6 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </RadarChart>
              </ResponsiveContainer>
                </div>
                
            {/* ROI by Category - Green */}
            <div className="bg-black/40 pixel-border border-green-500/20 p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <h3 className="text-sm font-bold text-green-400 text-center">ROI by Category</h3>
              </div>
              <p className="text-xs text-center text-muted-foreground mb-3">Return on Investment %</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={getROIByCategory()}>
                  <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#15803d" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#14532d" strokeOpacity={0.2} strokeWidth={1} />
                  <PolarAngleAxis 
                    dataKey="category" 
                    tick={{ fill: '#86efac', fontSize: 12, fontWeight: 600 }} 
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={getRadarDomain(getROIByCategory(), 1.3)} 
                    tick={{ fill: '#4ade80', fontSize: 10 }} 
                    stroke="#15803d"
                    strokeOpacity={0.3}
                  />
                  <Radar 
                    name="ROI %" 
                    dataKey="value" 
                    stroke="#22c55e" 
                    fill="url(#greenGradient)" 
                    fillOpacity={0.85} 
                    strokeWidth={3}
                    dot={{ fill: '#22c55e', r: 4 }}
                    activeDot={{ fill: '#4ade80', r: 6 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </RadarChart>
              </ResponsiveContainer>
                </div>
                
            {/* Win Rate by Category - Orange */}
            <div className="bg-black/40 pixel-border border-orange-500/20 p-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h3 className="text-sm font-bold text-orange-400 text-center">Win Rate by Category</h3>
                </div>
              <p className="text-xs text-center text-muted-foreground mb-3">Percentage profitable</p>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={getWinRateByCategory()}>
                  <defs>
                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#c2410c" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#7c2d12" strokeOpacity={0.2} strokeWidth={1} />
                  <PolarAngleAxis 
                    dataKey="category" 
                    tick={{ fill: '#fdba74', fontSize: 12, fontWeight: 600 }} 
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={getRadarDomain(getWinRateByCategory(), 1.2)} 
                    tick={{ fill: '#fb923c', fontSize: 10 }} 
                    stroke="#c2410c"
                    strokeOpacity={0.3}
                  />
                  <Radar 
                    name="Win %" 
                    dataKey="value" 
                    stroke="#f97316" 
                    fill="url(#orangeGradient)" 
                    fillOpacity={0.85} 
                    strokeWidth={3}
                    dot={{ fill: '#f97316', r: 4 }}
                    activeDot={{ fill: '#fb923c', r: 6 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />
                </RadarChart>
              </ResponsiveContainer>
              </div>
          </div>

          {/* Top Category Stats - Key Insights 💎 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {activity.categoryBreakdown.slice(0, 3).map((cat, idx) => {
              const colors = [
                { border: 'border-blue-500/30', text: 'text-blue-400' },
                { border: 'border-green-500/30', text: 'text-green-400' },
                { border: 'border-orange-500/30', text: 'text-orange-400' }
              ]
              const color = colors[idx] || colors[0]
              
              // NULL SAFETY! 🛡️
              const winRate = typeof cat.winRate === 'number' && !isNaN(cat.winRate) ? cat.winRate : 0
              const roi = typeof cat.roi === 'number' && !isNaN(cat.roi) ? cat.roi : 0
              const avgProfit = typeof cat.avgProfit === 'number' && !isNaN(cat.avgProfit) ? cat.avgProfit : 0
              const biggestWin = typeof cat.biggestWin === 'number' && !isNaN(cat.biggestWin) ? cat.biggestWin : 0
              const avgHoldTime = typeof cat.avgHoldTime === 'number' && !isNaN(cat.avgHoldTime) ? cat.avgHoldTime : 0
              const consistency = typeof cat.consistency === 'number' && !isNaN(cat.consistency) ? cat.consistency : 0
              
              return (
                <div key={cat.category} className={`bg-black/60 pixel-border ${color.border} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-sm font-bold ${color.text}`}>{cat.category}</h4>
                    <span className="text-xs text-muted-foreground">{cat.count} trades</span>
        </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-1">Win Rate</p>
                      <p className={`font-bold ${winRate >= 50 ? 'text-green-400' : 'text-orange-400'}`}>
                        {winRate > 0 ? `${winRate.toFixed(1)}%` : 'N/A'}
                      </p>
          </div>

                    <div>
                      <p className="text-muted-foreground mb-1">ROI</p>
                      <p className={`font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {roi !== 0 ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '0%'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">Avg Profit</p>
                      <p className={`font-bold ${avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {avgProfit !== 0 ? `${avgProfit > 0 ? '+' : ''}$${Math.abs(avgProfit).toFixed(0)}` : '$0'}
              </p>
            </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Biggest Win</p>
                      <p className="font-bold text-green-400">
                        {biggestWin > 0 ? `+$${biggestWin.toFixed(0)}` : '$0'}
                      </p>
            </div>

                    <div>
                      <p className="text-muted-foreground mb-1">Avg Hold</p>
                      <p className="font-bold text-blue-400">
                        {avgHoldTime > 0 ? `${avgHoldTime.toFixed(1)}h` : 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground mb-1">Consistency</p>
                      <p className={`font-bold ${consistency >= 70 ? 'text-green-400' : consistency >= 40 ? 'text-yellow-400' : 'text-orange-400'}`}>
                        {consistency > 0 ? `${consistency.toFixed(0)}%` : 'N/A'}
              </p>
            </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Finished Trades Chart */}
      {activity && activity.trades && activity.trades.length > 0 && (
        <div className="bg-card pixel-border border-cyan-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-cyan-400">FINISHED_TRADES: 🍉 CHART</h2>
        </div>
          <p className="text-xs text-muted-foreground mb-4">
            Trades in the <span className="text-green-500">■</span> green area are profitable, while those in the <span className="text-red-500">■</span> red area are losses. Circle size represents the trade&apos;s dollar value.
          </p>
          
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              
              <XAxis 
                type="number" 
                dataKey="buyPrice" 
                name="Buy Price" 
                label={{ value: 'Buy Price', position: 'bottom', fill: '#888' }}
                stroke="#666"
                domain={[0, 100]}
              />
              <YAxis 
                type="number" 
                dataKey="sellPrice" 
                name="Sell Price"
                label={{ value: 'Sell Price', angle: -90, position: 'left', fill: '#888' }}
                stroke="#666"
                domain={[0, 100]}
              />
              <ZAxis type="number" dataKey="size" range={[20, 400]} />
              
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-black/90 border border-white/20 p-3 pixel-border">
                        <p className="text-white font-bold mb-1">{data.category}</p>
                        <p className="text-xs text-muted-foreground">Buy: {data.buyPrice.toFixed(1)}¢</p>
                        <p className="text-xs text-muted-foreground">Sell: {data.sellPrice.toFixed(1)}¢</p>
                        <p className={`text-sm font-bold ${data.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {data.profit >= 0 ? '+' : ''}${data.profit.toFixed(0)}
                    </p>
                  </div>
                    )
                  }
                  return null
                }}
              />
              
              {/* Profit zone (above diagonal) */}
              <rect x="0" y="0" width="100%" height="50%" fill="url(#profitGradient)" opacity={0.1} />
              
              {/* Loss zone (below diagonal) */}
              <rect x="0" y="50%" width="100%" height="50%" fill="url(#lossGradient)" opacity={0.1} />
              
              {/* Diagonal line (break-even) */}
              <line x1="0" y1="100%" x2="100%" y2="0" stroke="#666" strokeWidth={2} strokeDasharray="5,5" />
              
              <Scatter name="Trades" data={getFinishedTrades()} fill="#8884d8">
                {getFinishedTrades().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} opacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          </div>
      )}

      {/* Activity Timeline - Last Trade Only */}
      {activity && activity.lastTrade && (
        <div className="bg-card pixel-border border-yellow-500/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-6 w-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-yellow-400">ACTIVITY_TIMELINE</h2>
          </div>

          <div className="bg-black/40 pixel-border border-white/20 p-6">
            <p className="text-xs text-muted-foreground mb-2 uppercase">Last Trade</p>
            <p className="text-2xl font-bold text-white">
              {new Date(activity.lastTrade * 1000).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {(() => {
                const hoursAgo = Math.floor((Date.now() - activity.lastTrade * 1000) / (1000 * 60 * 60));
                if (hoursAgo < 1) {
                  const minsAgo = Math.floor((Date.now() - activity.lastTrade * 1000) / (1000 * 60));
                  return `${minsAgo} minutes ago`;
                }
                if (hoursAgo < 24) return `${hoursAgo} hours ago`;
                const daysAgo = Math.floor(hoursAgo / 24);
                return `${daysAgo} days ago`;
              })()}
              </p>
            </div>
          </div>
        )}

      {/* NEON ARCADE Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes borderFlow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.6; }
        }

        @keyframes scanMove {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  )
}
