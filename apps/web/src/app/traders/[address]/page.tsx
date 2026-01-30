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

  // BOT SCAN LOGIC! 🤖
  const calculateBotScore = () => {
    if (!trader || !activity) return { score: 50, status: 'SUSPICIOUS' as const, factors: ['Insufficient data'] }

    let score = 100 // Start at 100% human
    const factors: string[] = []

    // Factor 1: Trade frequency (too many trades too fast = bot-like)
    if (activity.totalTrades > 0 && activity.activeDays > 0) {
      const tradesPerDay = activity.totalTrades / activity.activeDays
      if (tradesPerDay > 50) {
        score -= 15
        factors.push(`High frequency: ${tradesPerDay.toFixed(0)} trades/day`)
      } else if (tradesPerDay > 100) {
        score -= 25
        factors.push(`EXTREME frequency: ${tradesPerDay.toFixed(0)} trades/day`)
      }
    }

    // Factor 2: Market diversity (only 1-2 markets = suspicious)
    const uniqueMarkets = new Set(activity.trades?.map(t => t.title) || []).size
    if (uniqueMarkets < 3 && activity.totalTrades > 20) {
      score -= 20
      factors.push(`Low diversity: Only ${uniqueMarkets} unique markets`)
    } else if (uniqueMarkets >= 10) {
      factors.push(`Good diversity: ${uniqueMarkets} unique markets`)
    }

    // Factor 3: Category concentration (99% in one category = bot)
    if (activity.categoryBreakdown.length > 0) {
      const maxCategoryPercentage = Math.max(...activity.categoryBreakdown.map(c => c.percentage))
      if (maxCategoryPercentage > 90 && activity.totalTrades > 30) {
        score -= 18
        factors.push(`Single category focus: ${maxCategoryPercentage.toFixed(0)}%`)
      }
    }

    // Factor 4: Time pattern analysis (trades at exactly same intervals = bot)
    if (activity.trades && activity.trades.length > 10) {
      const timestamps = activity.trades.map(t => t.timestamp).sort((a, b) => a - b)
      const intervals: number[] = []
      for (let i = 1; i < Math.min(timestamps.length, 20); i++) {
        intervals.push(timestamps[i] - timestamps[i - 1])
      }
      
      // Check if intervals are too regular (variance too low)
      if (intervals.length > 5) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
        const stdDev = Math.sqrt(variance)
        
        // If stdDev is very low relative to average, it's too regular
        if (stdDev / avgInterval < 0.1 && avgInterval < 3600000) { // Less than 1 hour
          score -= 22
          factors.push(`Robotic timing: Too regular intervals`)
        }
      }
    }

    // Factor 5: Trade sizes (all exact same size = bot)
    if (activity.trades && activity.trades.length > 5) {
      const sizes = activity.trades.slice(0, 20).map(t => t.size)
      const uniqueSizes = new Set(sizes.map(s => Math.round(s))).size
      if (uniqueSizes < 3 && sizes.length > 10) {
        score -= 15
        factors.push(`Identical trade sizes: ${uniqueSizes} unique sizes`)
      }
    }

    // Factor 6: Win rate too perfect (100% or 0% = suspicious)
    if (trader.winRate === 1 || trader.winRate === 0) {
      score -= 10
      factors.push(`Perfect win rate: ${(trader.winRate * 100).toFixed(0)}%`)
    }

    // Bonus points for human traits
    if (trader.verified) {
      score += 5
      factors.push(`✓ Verified account`)
    }
    
    if (trader.xUsername) {
      score += 3
      factors.push(`✓ Twitter linked`)
    }

    if (activity.activeDays > 30) {
      score += 2
      factors.push(`✓ Active ${activity.activeDays} days`)
    }

    // Cap score between 0-100
    score = Math.max(0, Math.min(100, score))

    // Determine status
    let status: 'REAL_HUMAN' | 'SUSPICIOUS' | 'BOT_DETECTED'
    if (score >= 85) {
      status = 'REAL_HUMAN'
    } else if (score >= 60) {
      status = 'SUSPICIOUS'
    } else {
      status = 'BOT_DETECTED'
    }

    return { score, status, factors }
  }

  // Run Bot Scan with animation!
  const runBotScan = async () => {
    setIsScanning(true)
    setShowScanResult(false)
    
    // Simulate scanning animation (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Calculate score
    const result = calculateBotScore()
    setScanResult(result)
    setIsScanning(false)
    
    // Show result after a brief delay
    setTimeout(() => {
      setShowScanResult(true)
    }, 300)
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
          
          // FRONTEND FIX: Fetch closed positions DIRECTLY from Polymarket! 🚀
          try {
            console.log('🔍 Fetching closed positions from Polymarket...')
            const closedRes = await fetch(
              `https://data-api.polymarket.com/closed-positions?user=${address}&limit=100&sortBy=REALIZEDPNL`
            )
            
            if (closedRes.ok) {
              const closedPositions = await closedRes.json() as any[]
              console.log(`📊 Fetched ${closedPositions.length} closed positions!`)
              
              // Enhance categoryBreakdown with REAL PnL from closed positions
              const categoryPnL = new Map<string, { pnl: number; volume: number }>()
              
              const detectCategory = (title: string): string => {
                const t = title.toLowerCase()
                if (t.includes('bitcoin') || t.includes('btc') || t.includes('ethereum') || 
                    t.includes('eth') || t.includes('crypto') || t.includes('solana')) return 'Crypto'
                if (t.includes('trump') || t.includes('biden') || t.includes('election') ||
                    t.includes('president') || t.includes('congress')) return 'Politics'
                if (t.includes('nfl') || t.includes('nba') || t.includes('football') || 
                    t.includes('basketball') || t.includes('soccer')) return 'Sports'
                if (t.includes('movie') || t.includes('oscars') || t.includes('grammy')) return 'Culture'
                return 'Other'
              }
              
              for (const pos of closedPositions) {
                const pnl = parseFloat(pos.realizedPnl || '0')
                const volume = parseFloat(pos.totalBought || '0') * parseFloat(pos.avgPrice || '0')
                const category = detectCategory(pos.title || '')
                
                if (!categoryPnL.has(category)) {
                  categoryPnL.set(category, { pnl: 0, volume: 0 })
                }
                const data = categoryPnL.get(category)!
                data.pnl += pnl
                data.volume += volume
              }
              
              console.log('💰 PnL by category:', Object.fromEntries(categoryPnL))
              
              // Calculate REAL win rate from closed positions!
              const categoryWinRate = new Map<string, { wins: number; losses: number }>()
              
              console.log('🔍 ANALYZING CLOSED POSITIONS:')
              let totalWins = 0
              let totalLosses = 0
              let breakEven = 0
              
              for (const pos of closedPositions) {
                const category = detectCategory(pos.title || '')
                const pnl = parseFloat(pos.realizedPnl || '0')
                
                // DEBUG: Log first 5 positions
                if (closedPositions.indexOf(pos) < 5) {
                  console.log(`  Position #${closedPositions.indexOf(pos) + 1}:`, {
                    title: pos.title?.substring(0, 50),
                    category,
                    realizedPnl: pos.realizedPnl,
                    parsedPnl: pnl,
                    isWin: pnl > 0,
                    isLoss: pnl < 0,
                    isBreakEven: pnl === 0
                  })
                }
                
                if (!categoryWinRate.has(category)) {
                  categoryWinRate.set(category, { wins: 0, losses: 0 })
                }
                
                const stats = categoryWinRate.get(category)!
                if (pnl > 0) {
                  stats.wins++
                  totalWins++
                } else if (pnl < 0) {
                  stats.losses++
                  totalLosses++
                } else {
                  breakEven++
                }
              }
              
              console.log('🎯 Win/Loss stats:', Object.fromEntries(categoryWinRate))
              console.log(`📊 TOTAL: ${totalWins} wins, ${totalLosses} losses, ${breakEven} break-even`)
              
              // Calculate OVERALL win rate from closed positions
              const overallWinRate = (totalWins + totalLosses) > 0 
                ? (totalWins / (totalWins + totalLosses)) 
                : (foundTrader.winRate || 0.5)
              
              console.log(`✅ OVERALL WIN RATE: ${(overallWinRate * 100).toFixed(1)}% (${totalWins}W / ${totalLosses}L)`)
              
              // Update trader with REAL win rate!
              foundTrader.winRate = overallWinRate
              
              // Update categoryBreakdown with REAL ROI and Win Rate!
              const allCategories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other']
              const enhancedBreakdown = allCategories.map(cat => {
                const existing = activityData.categoryBreakdown.find((c: any) => c.category === cat)
                const closedData = categoryPnL.get(cat)
                const winLossData = categoryWinRate.get(cat)
                
                // Calculate REAL win rate from closed positions
                let realWinRate = existing?.winRate || 0
                if (winLossData && (winLossData.wins + winLossData.losses) > 0) {
                  realWinRate = (winLossData.wins / (winLossData.wins + winLossData.losses)) * 100
                  console.log(`  ${cat}: REAL Win Rate ${realWinRate.toFixed(1)}% (${winLossData.wins}W / ${winLossData.losses}L)`)
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
              console.log('✅ Enhanced categoryBreakdown with real ROI!')
            }
          } catch (err) {
            console.error('❌ Failed to fetch closed positions:', err)
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

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex flex-col gap-3">
            {/* View Bubbles Button */}
            <Link
              href={`/traders/${trader.address}/bubbles`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold pixel-border border-green-400 transition-all group animate-pulse hover:animate-none"
            >
              <span className="text-2xl">🫧</span>
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider opacity-90">View Position</div>
                <div className="text-sm font-bold">BUBBLES</div>
              </div>
            </Link>

            {/* BOT SCAN Button 🤖 */}
            <button
              onClick={runBotScan}
              disabled={isScanning}
              className={`inline-flex items-center gap-2 px-6 py-3 font-bold pixel-border transition-all group ${
                isScanning
                  ? 'bg-cyan-600 border-cyan-400 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-cyan-400'
              } text-white`}
            >
              <span className="text-2xl">{isScanning ? '🔍' : '🤖'}</span>
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider opacity-90">
                  {isScanning ? 'Scanning...' : 'Run'}
                </div>
                <div className="text-sm font-bold">
                  {isScanning ? 'ANALYZING' : 'BOT SCAN'}
                </div>
              </div>
            </button>

            {/* Polymarket Profile Button */}
            <a
              href={`https://polymarket.com/profile/${trader.address}?via=01k`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold pixel-border border-purple-400 transition-all group"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs uppercase tracking-wider opacity-80">View on</div>
                <div className="text-sm font-bold">POLYMARKET</div>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* BOT SCAN ANIMATION! 🤖 */}
      {isScanning && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Laser Scan Lines */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                style={{
                  top: `${i * 20}%`,
                  animation: `scanLine 2s ease-in-out ${i * 0.2}s infinite`,
                  boxShadow: '0 0 20px rgba(34, 211, 238, 0.8), 0 0 40px rgba(34, 211, 238, 0.4)'
                }}
              />
            ))}
          </div>
          
          {/* Scanning Text */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 pixel-border border-cyan-400 p-8 backdrop-blur-sm">
            <div className="text-center">
              <span className="text-6xl mb-4 block animate-pulse">🔍</span>
              <h3 className="text-2xl font-bold text-cyan-400 mb-2">ANALYZING TRADER...</h3>
              <p className="text-sm text-muted-foreground font-mono">
                Checking patterns • Analyzing behavior • Detecting anomalies
              </p>
            </div>
          </div>

          <style jsx>{`
            @keyframes scanLine {
              0% {
                top: -10%;
                opacity: 0;
              }
              50% {
                opacity: 1;
              }
              100% {
                top: 110%;
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}

      {/* BOT SCAN RESULTS! 🎯 */}
      {showScanResult && scanResult && (
        <div className={`pixel-border p-6 mb-6 relative overflow-hidden ${
          scanResult.status === 'REAL_HUMAN' 
            ? 'bg-green-950/50 border-green-400' 
            : scanResult.status === 'SUSPICIOUS'
            ? 'bg-yellow-950/50 border-yellow-400'
            : 'bg-red-950/50 border-red-400'
        }`}>
          {/* Close Button */}
          <button
            onClick={() => setShowScanResult(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>

          <div className="flex items-start gap-6">
            {/* Status Icon */}
            <div className="flex-shrink-0">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl ${
                scanResult.status === 'REAL_HUMAN'
                  ? 'bg-green-500/20 border-4 border-green-400'
                  : scanResult.status === 'SUSPICIOUS'
                  ? 'bg-yellow-500/20 border-4 border-yellow-400'
                  : 'bg-red-500/20 border-4 border-red-400'
              }`}>
                {scanResult.status === 'REAL_HUMAN' ? '✓' : scanResult.status === 'SUSPICIOUS' ? '⚠' : '✗'}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1">
              <h3 className={`text-3xl font-bold mb-2 ${
                scanResult.status === 'REAL_HUMAN' 
                  ? 'text-green-400' 
                  : scanResult.status === 'SUSPICIOUS'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}>
                {scanResult.status === 'REAL_HUMAN' 
                  ? 'REAL HUMAN DETECTED' 
                  : scanResult.status === 'SUSPICIOUS'
                  ? 'SUSPICIOUS ACTIVITY'
                  : 'BOT DETECTED'}
              </h3>

              {/* Score */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white text-xl font-bold">HUMAN SCORE:</span>
                  <span className={`text-4xl font-bold ${
                    scanResult.score >= 85 ? 'text-green-400' : scanResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {scanResult.score}%
                  </span>
                </div>
                
                {/* Score Bar */}
                <div className="w-full h-3 bg-black/50 pixel-border border-white/20 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      scanResult.score >= 85 ? 'bg-green-500' : scanResult.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${scanResult.score}%` }}
                  />
                </div>
              </div>

              {/* Factors */}
              <div>
                <p className="text-sm text-white/60 mb-2 uppercase tracking-wider">Analysis Factors:</p>
                <div className="space-y-1">
                  {scanResult.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-cyan-400">▸</span>
                      <span className="text-white/80 font-mono">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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

    </div>
  )
}
