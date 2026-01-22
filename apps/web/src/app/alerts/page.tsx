'use client'

import { useState, useEffect } from 'react'
import { Bell, TrendingUp, Zap, DollarSign, Activity } from 'lucide-react'

// 🔗 Polymarket Referral Code (same as API redirect)
const REFERRAL_CODE = '01k'

interface Alert {
  id: string
  type: 'whale' | 'price_move'
  title: string
  description: string
  timestamp: Date
  severity: 'high' | 'medium' | 'low'
  icon: string
  marketSlug?: string // For VIEW button link
  marketId?: string // Market ID for redirect API
}

// Build Polymarket link with referral (same logic as Alpha Markets!)
function getPolymarketLink(marketSlug?: string): string {
  if (!marketSlug) return `https://polymarket.com?via=${REFERRAL_CODE}`
  
  // ALWAYS use /event/ URL (Polymarket standard)
  // For multi-outcome markets: clean outcome suffix (-500-519, etc.)
  // For regular markets: use slug as-is
  const hasOutcomePattern = /-\d{3}-\d{3}$/.test(marketSlug)
  
  if (hasOutcomePattern) {
    // Multi-outcome: elon-tweets-500-519 → elon-tweets
    const cleanSlug = marketSlug.replace(/-\d{3}-\d{3}$/, '')
    return `https://polymarket.com/event/${cleanSlug}?via=${REFERRAL_CODE}`
  } else {
    // Regular market: use slug as-is
    return `https://polymarket.com/event/${marketSlug}?via=${REFERRAL_CODE}`
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [useDemo, setUseDemo] = useState(false)

  // Fetch real alerts from API
  const fetchAlerts = async () => {
    try {
      setLoading(true)
      
      // Fetch with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
      
      const response = await fetch('/api/telegram-alerts?limit=50', {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        console.warn('API returned error, using demo data')
        setUseDemo(true)
        loadDemoAlerts()
        return
      }
      
      const data = await response.json()
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('No alerts found, using demo data')
        setUseDemo(true)
        loadDemoAlerts()
        return
      }
      
      // Parse timestamps and map market_slug to marketSlug
      const parsedData = data.map((alert: any) => ({
        ...alert,
        marketSlug: alert.market_slug || alert.marketSlug, // Support both formats
        timestamp: new Date(alert.timestamp)
      }))
      
      setAlerts(parsedData)
      setUseDemo(false)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
      setUseDemo(true)
      loadDemoAlerts()
    } finally {
      setLoading(false)
    }
  }

  // Generate demo alerts (fallback) - ONLY WHALES + PRICE MOVES
  const loadDemoAlerts = () => {
    const demoAlerts: Alert[] = [
      {
        id: '1',
        type: 'whale',
        title: 'WHALE ALERT',
        description: 'Epstein blackmail evidence released in 2025? - Yes @ 0.999 (≈ $125,796,677) 0x44c1...ebc1',
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
        severity: 'low',
        icon: '🐋',
        marketSlug: 'epstein-blackmail-evidence-released-in-2025'
      },
      {
        id: '2',
        type: 'whale',
        title: 'WHALE ALERT',
        description: 'Epstein blackmail evidence released in 2025? - Yes @ 0.999 (≈ $215,615,803) 0x7072...3413',
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
        severity: 'high',
        icon: '🐋',
        marketSlug: 'epstein-blackmail-evidence-released-in-2025'
      },
      {
        id: '3',
        type: 'price_move',
        title: 'PRICE MOVE UP',
        description: 'Will Elon Musk post 500-519 tweets from January 16 to January 23, 2026? - Yes: 0.007 → 0.008 (+18.5% in 4s)',
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
        severity: 'medium',
        icon: '📊',
        marketSlug: 'will-elon-musk-post-500-519-tweets-from-january-16-to-january-23-2026'
      },
      {
        id: '4',
        type: 'price_move',
        title: 'PRICE MOVE UP',
        description: 'Will Édouard Philippe win the 2027 French presidential election? - Yes: 0.140 → 0.160 (+14.3% in 10s)',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'medium',
        icon: '📊',
        marketSlug: 'will-edouard-philippe-win-the-2027-french-presidential-election'
      },
      {
        id: '5',
        type: 'price_move',
        title: 'PRICE MOVE UP',
        description: 'Will CME Group (CME) beat quarterly earnings? - Yes: 0.560 → 0.920 (+64.3% in 6s)',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'high',
        icon: '📊',
        marketSlug: 'will-cme-group-cme-beat-quarterly-earnings'
      },
      {
        id: '6',
        type: 'price_move',
        title: 'PRICE MOVE UP',
        description: 'Will Israel strike ≥1 countries in January 2026? - Yes: 0.650 → 0.730 (+12.3% in 10s)',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'medium',
        icon: '📊',
        marketSlug: 'will-israel-strike-1-countries-in-january-2026'
      },
      {
        id: '7',
        type: 'price_move',
        title: 'PRICE MOVE UP',
        description: 'Will Elon Musk post 520-539 tweets from January 20 to January 27, 2026? - Yes: 0.020 → 0.023 (+17.0% in nulls)',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'medium',
        icon: '📊',
        marketSlug: 'will-elon-musk-post-520-539-tweets-from-january-20-to-january-27-2026'
      },
    ]
    setAlerts(demoAlerts)
  }

  useEffect(() => {
    // Initial load - start with demo data immediately
    loadDemoAlerts()
    setUseDemo(true)
    
    // Then try to fetch real data
    fetchAlerts()
    
    // Auto-refresh every 10 seconds (only if not using demo)
    const interval = setInterval(() => {
      if (!useDemo) {
        fetchAlerts()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(a => a.type === filter)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500/30 bg-red-500/5'
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5'
      case 'low': return 'border-blue-500/30 bg-blue-500/5'
      default: return 'border-primary/30 bg-primary/5'
    }
  }

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-10 w-1 h-1 bg-red-500 animate-pulse"></div>
          <div className="absolute top-8 right-20 w-1 h-1 bg-yellow-500 animate-pulse"></div>
          <div className="absolute top-4 right-40 w-1 h-1 bg-primary animate-pulse" style={{animationDelay: '0.5s'}}></div>
        </div>
        
        <div className="flex items-center gap-4 mb-3">
          <div className="text-4xl">🚨</div>
          <h1 className="text-2xl font-bold text-primary alien-glow tracking-wider">LIVE_ALERTS</h1>
          <span className="text-primary animate-pulse">█</span>
        </div>
        <p className="text-muted-foreground font-mono text-sm">
          &gt; MONITORING SMART MONEY NETWORK... {alerts.length} SIGNALS DETECTED
        </p>
      </div>

      {/* Filters - ONLY 2 TYPES */}
      <div className="bg-card pixel-border border-white/20 p-5 mb-6 flex flex-wrap gap-4 items-center relative">
        <div className="absolute top-2 right-2 text-primary text-xs font-mono animate-pulse">FILTER.SYS</div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary">ALERT_TYPE:</span>
          <div className="flex gap-3">
            {[
              { id: 'all', label: 'ALL', icon: '📡' },
              { id: 'whale', label: 'WHALE MOVES', icon: '🐋' },
              { id: 'price_move', label: 'PRICE MOVERS', icon: '📊' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setFilter(type.id)}
                className={`px-4 py-2 text-sm font-bold uppercase transition-all pixel-border flex items-center gap-2 ${
                  filter === type.id
                    ? 'bg-primary text-black border-primary'
                    : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
                }`}
              >
                <span className="text-lg">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar - ONLY 2 TYPES */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {[
          { label: 'WHALE MOVES', value: alerts.filter(a => a.type === 'whale').length, icon: '🐋', color: 'text-red-500', desc: 'Big trades >$100K' },
          { label: 'PRICE MOVERS', value: alerts.filter(a => a.type === 'price_move').length, icon: '📊', color: 'text-green-500', desc: 'Sharp price changes ±10%' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card pixel-border border-white/10 p-6 relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-mono text-muted-foreground block mb-1">{stat.label}</span>
                  <span className="text-xs text-muted-foreground/60">{stat.desc}</span>
                </div>
                <span className="text-4xl">{stat.icon}</span>
              </div>
              <div className={`text-5xl font-bold ${stat.color} font-mono`}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.map((alert, index) => (
          <div
            key={alert.id}
            className={`pixel-border p-4 relative overflow-hidden group hover:border-primary/50 transition-all ${getSeverityColor(alert.severity)}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Pulsing indicator */}
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
              alert.severity === 'high' ? 'bg-red-500' : 
              alert.severity === 'medium' ? 'bg-yellow-500' : 
              'bg-blue-500'
            } animate-pulse`}></div>

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-3xl flex-shrink-0">{alert.icon}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-bold text-primary tracking-wider font-mono">{alert.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-bold uppercase pixel-border ${
                    alert.severity === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-base text-white mb-2">{alert.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {getTimeAgo(alert.timestamp)}
                  </span>
                  <span className="text-primary">●</span>
                  <span className="uppercase">{alert.type.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(getPolymarketLink(alert.marketSlug), '_blank')}
                  className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase pixel-border transition-all hover:scale-105"
                >
                  VIEW
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredAlerts.length === 0 && (
        <div className="text-center py-16 bg-card pixel-border border-white/10">
          <div className="text-6xl mb-4">📡</div>
          <p className="text-muted-foreground font-mono">NO ALERTS MATCHING FILTER</p>
          <p className="text-sm text-muted-foreground mt-2">Try selecting a different alert type</p>
        </div>
      )}

      {/* Footer note */}
      <div className={`mt-8 bg-card pixel-border p-4 ${useDemo ? 'border-yellow-500/30' : 'border-primary/30'}`}>
        <div className="flex items-center gap-3">
          <span className={`text-xl animate-pulse ${useDemo ? 'text-yellow-500' : 'text-primary'}`}>
            {useDemo ? '🔧' : '⚡'}
          </span>
          <div>
            <p className={`text-sm font-mono ${useDemo ? 'text-yellow-500' : 'text-primary'}`}>
              {useDemo ? 'DEMO MODE' : 'LIVE MODE ACTIVE'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {useDemo 
                ? 'Showing demo data. Connect Telegram bot to see real-time alerts from Polymarket.'
                : `Real-time alerts from Telegram bot. Auto-refresh every 10 seconds. ${alerts.length} total alerts.`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

