import { NextResponse } from 'next/server'
import { analyzeMarkets } from '@/lib/smart-markets'

export async function GET() {
  try {
    console.log('🧠 Starting REAL on-chain Smart Markets analysis...')
    
    // 1. Отримуємо топ S/A/B трейдерів
    const tradersRes = await fetch('http://localhost:3000/api/traders')
    if (!tradersRes.ok) throw new Error('Failed to fetch traders')
    const allTraders = await tradersRes.json()
    
    // Фільтруємо S/A/B tier (Multicall швидкий - можемо більше!)
    const smartTraders = allTraders
      .filter((t: any) => ['S', 'A', 'B'].includes(t.tier))
      .slice(0, 50) // 50 трейдерів (Multicall = швидко!)
      .map((t: any) => ({
        address: t.address,
        displayName: t.displayName,
        tier: t.tier,
        rarityScore: t.rarityScore
      }))
    
    console.log(`📊 Traders: S=${smartTraders.filter((t: any) => t.tier === 'S').length}, A=${smartTraders.filter((t: any) => t.tier === 'A').length}, B=${smartTraders.filter((t: any) => t.tier === 'B').length}`)
    
    // 2. Отримуємо топ маркети (активні) - 20 маркетів
    const marketsRes = await fetch('http://localhost:3000/api/markets?limit=20&sortBy=volume&status=active')
    if (!marketsRes.ok) throw new Error('Failed to fetch markets')
    const markets = await marketsRes.json()
    
    console.log(`📈 Analyzing ${markets.length} markets...`)
    
    // 3. РЕАЛЬНИЙ ON-CHAIN АНАЛІЗ
    const smartMarkets = await analyzeMarkets(
      markets,
      smartTraders,
      5 // Batch size: 5 markets at a time (збільшили для швидкості)
    )
    
    console.log(`✅ Found ${smartMarkets.length} smart markets with real on-chain data!`)
    
    return NextResponse.json(smartMarkets)
  } catch (error) {
    console.error('❌ Failed to analyze smart markets:', error)
    return NextResponse.json({ error: 'Failed to analyze markets' }, { status: 500 })
  }
}
