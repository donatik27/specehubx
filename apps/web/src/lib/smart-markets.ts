import { checkTradersInMarket } from './blockchain'

export interface SmartMarketData {
  marketId: string
  question: string
  category: string
  volume: number
  liquidity: number
  smartCount: number // кількість S/A трейдерів
  smartWeighted: number // сума rarityScore
  smartScore: number // фінальнийScore
  topTraders: Array<{
    address: string
    displayName: string
    profilePicture?: string | null
    tier: string
    rarityScore: number
  }>
  eventTitle?: string // Event title for multi-outcome markets
  eventSlug?: string // Event slug
  outcomeCount?: number // Number of outcomes in event
}

export interface TraderData {
  address: string
  displayName: string
  profilePicture?: string | null
  tier: string
  rarityScore: number
}

/**
 * Аналізує маркет і рахує Smart Score (РЕАЛЬНИЙ ON-CHAIN)
 */
export async function analyzeMarket(
  market: any,
  smartTraders: TraderData[]
): Promise<SmartMarketData> {
  // Get clobTokenIds from market (YES/NO tokens)
  const tokenIds = market.clobTokenIds || []
  
  if (tokenIds.length === 0) {
    console.warn(`Market ${market.id} has no clobTokenIds`)
    return {
      marketId: market.id,
      question: market.question,
      category: market.category,
      volume: market.volume,
      liquidity: market.liquidity,
      smartCount: 0,
      smartWeighted: 0,
      smartScore: 0,
      topTraders: []
    }
  }
  
  // РЕАЛЬНИЙ ON-CHAIN ЗАПИТ: перевіряємо які трейдери мають позиції
  const tradersInMarket = await checkTradersInMarket(
    smartTraders.map(t => t.address),
    tokenIds // Pass YES/NO token IDs
  )
  
  // Фільтруємо тільки тих хто має позиції
  const activeTraders = smartTraders.filter((trader, idx) => 
    tradersInMarket[idx]?.hasPosition
  )
  
  // Рахуємо метрики з tier weights
  const smartCount = activeTraders.length
  const smartWeighted = activeTraders.reduce((sum, t) => sum + t.rarityScore, 0)
  const smartScore = calculateSmartScore(activeTraders, market)
  
  console.log(`✅ Market "${market.question.slice(0, 50)}..." - ${smartCount} smart traders found on-chain`)
  
  return {
    marketId: market.id,
    question: market.question,
    category: market.category,
    volume: market.volume,
    liquidity: market.liquidity,
    smartCount,
    smartWeighted,
    smartScore,
    topTraders: activeTraders // Show ALL smart traders
      .sort((a, b) => {
        // Sort by tier first (S > A > B > C), then by rarityScore
        const tierDiff = (TIER_WEIGHTS[b.tier] || 0) - (TIER_WEIGHTS[a.tier] || 0)
        if (tierDiff !== 0) return tierDiff
        return b.rarityScore - a.rarityScore
      })
  }
}

/**
 * Аналізує багато маркетів паралельно
 */
export async function analyzeMarkets(
  markets: any[],
  smartTraders: TraderData[],
  batchSize: number = 5 // Обмежуємо паралельні запити
): Promise<SmartMarketData[]> {
  const results: SmartMarketData[] = []
  
  // Обробляємо батчами щоб не перевантажити RPC
  for (let i = 0; i < markets.length; i += batchSize) {
    const batch = markets.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(market => analyzeMarket(market, smartTraders))
    )
    results.push(...batchResults)
    
    console.log(`Analyzed ${Math.min(i + batchSize, markets.length)}/${markets.length} markets`)
  }
  
  // Сортуємо по Smart Score
  return results
    .filter(m => m.smartCount > 0) // Тільки де є S/A трейдери
    .sort((a, b) => b.smartScore - a.smartScore)
}

/**
 * Tier weights for Smart Score calculation
 * S tier = 5 points, A = 3, B = 2, C = 1, D/E = 0
 */
const TIER_WEIGHTS: Record<string, number> = {
  'S': 5,
  'A': 3,
  'B': 2,
  'C': 1,
  'D': 0,
  'E': 0
}

/**
 * Calculate Smart Score based on tier composition
 * Example: 4x Tier B (8 points) > 1x Tier S (5 points)
 */
export function calculateSmartScore(traders: TraderData[], market: any): number {
  // Base score: sum of tier weights
  const tierScore = traders.reduce((sum, t) => sum + (TIER_WEIGHTS[t.tier] || 0), 0)
  
  // Bonus for diversity: having multiple tiers is good
  const uniqueTiers = new Set(traders.map(t => t.tier)).size
  const diversityBonus = uniqueTiers * 0.5
  
  // Volume factor: deeper markets are more reliable
  const volumeFactor = Math.log10(Math.max(market.volume, 1))
  
  // Final score
  return (tierScore + diversityBonus) * volumeFactor
}

// quickAnalyze REMOVED - тепер тільки РЕАЛЬНИЙ on-chain аналіз!
