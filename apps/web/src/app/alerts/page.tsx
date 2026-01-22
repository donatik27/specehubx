'use client'

import { useState, useEffect } from 'react'
import { Bell, TrendingUp, Zap, DollarSign, Activity } from 'lucide-react'

interface Alert {
  id: string
  type: 'whale' | 'smart_trader' | 'hot_market' | 'price_move'
  title: string
  description: string
  timestamp: Date
  severity: 'high' | 'medium' | 'low'
  icon: string
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
      
      // Parse timestamps
      const parsedData = data.map(alert => ({
        ...alert,
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

  // Generate demo alerts (fallback)
  const loadDemoAlerts = () => {
    const demoAlerts: Alert[] = [
      {
        id: '1',
        type: 'whale',
        title: 'WHALE ALERT',
        description: 'Theo4 placed $125K on "Trump wins 2024" at 61¢',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        severity: 'high',
        icon: '🐋'
      },
      {
        id: '2',
        type: 'smart_trader',
        title: 'SMART MONEY FLOW',
        description: '3 S-tier traders bought "ETH >$4K" in last 10 min',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        severity: 'high',
        icon: '🧠'
      },
      {
        id: '3',
        type: 'hot_market',
        title: 'MARKET HEATING UP',
        description: 'La Liga Winner: 8 smart traders active (+$250K volume)',
        timestamp: new Date(Date.now() - 12 * 60 * 1000),
        severity: 'medium',
        icon: '🔥'
      },
      {
        id: '4',
        type: 'price_move',
        title: 'PRICE SPIKE',
        description: 'Bitcoin >$120K moved from 45¢ → 67¢ (+48% in 1h)',
        timestamp: new Date(Date.now() - 18 * 60 * 1000),
        severity: 'medium',
        icon: '📈'
      },
      {
        id: '5',
        type: 'whale',
        title: 'WHALE ALERT',
        description: 'gopfan2 placed $89K on "S&P 500 ATH Jan 2025"',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
        severity: 'high',
        icon: '🐋'
      },
      {
        id: '6',
        type: 'smart_trader',
        title: 'SMART MONEY FLOW',
        description: 'ImJustKen bought "Lakers win NBA" at 12¢ (+$15K)',
        timestamp: new Date(Date.now() - 32 * 60 * 1000),
        severity: 'low',
        icon: '🧠'
      },
      {
        id: '7',
        type: 'hot_market',
        title: 'TRENDING MARKET',
        description: 'Democratic Nominee 2028: 12 smart traders (+$180K)',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        severity: 'medium',
        icon: '🔥'
      },
      {
        id: '8',
        type: 'price_move',
        title: 'PRICE DROP',
        description: 'Tesla $500 EOY dropped from 78¢ → 52¢ (-33%)',
        timestamp: new Date(Date.now() - 58 * 60 * 1000),
        severity: 'low',
        icon: '📉'
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

      {/* Filters */}
      <div className="bg-card pixel-border border-white/20 p-5 mb-6 flex flex-wrap gap-4 items-center relative">
        <div className="absolute top-2 right-2 text-primary text-xs font-mono animate-pulse">FILTER.SYS</div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-primary">ALERT_TYPE:</span>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'ALL', icon: '📡' },
              { id: 'whale', label: 'WHALES', icon: '🐋' },
              { id: 'smart_trader', label: 'SMART $', icon: '🧠' },
              { id: 'hot_market', label: 'HOT', icon: '🔥' },
              { id: 'price_move', label: 'PRICE', icon: '📊' },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setFilter(type.id)}
                className={`px-3 py-1 text-sm font-bold uppercase transition-all pixel-border flex items-center gap-2 ${
                  filter === type.id
                    ? 'bg-primary text-black border-primary'
                    : 'bg-transparent text-white border-white/30 hover:border-primary hover:text-primary'
                }`}
              >
                <span>{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'WHALE MOVES', value: alerts.filter(a => a.type === 'whale').length, icon: '🐋', color: 'text-red-500' },
          { label: 'SMART TRADES', value: alerts.filter(a => a.type === 'smart_trader').length, icon: '🧠', color: 'text-blue-500' },
          { label: 'HOT MARKETS', value: alerts.filter(a => a.type === 'hot_market').length, icon: '🔥', color: 'text-yellow-500' },
          { label: 'PRICE MOVES', value: alerts.filter(a => a.type === 'price_move').length, icon: '📊', color: 'text-green-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card pixel-border border-white/10 p-4 relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">{stat.label}</span>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.color} font-mono`}>{stat.value}</div>
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
                <button className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase pixel-border transition-all">
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

