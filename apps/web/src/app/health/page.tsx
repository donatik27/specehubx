'use client'

import { useEffect, useState } from 'react'
import HeartbeatMonitor from '@/components/HeartbeatMonitor'
import { Activity, Database, Zap, Users, TrendingUp, Clock } from 'lucide-react'

interface SystemVitals {
  status: string
  timestamp: string
  vitals: {
    heartbeat: {
      bpm: number
      volume24h: number
      volumeChange: string | null
    }
    markets: {
      active: number
      total: number
      liquidity: number
    }
    traders: {
      total: number
      sTier: number
      aTier: number
      bTier: number
    }
    performance: {
      apiResponseTime: number
      dbPingTime: number
      status: string
    }
    sync: {
      leaderboardLastSync: string | null
    }
  }
}

export default function HealthPage() {
  const [vitals, setVitals] = useState<SystemVitals | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch vitals every 5 seconds
  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const res = await fetch('/api/system-vitals', { cache: 'no-store' })
        const data = await res.json()
        setVitals(data)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch vitals:', error)
        setLoading(false)
      }
    }

    fetchVitals()
    const interval = setInterval(fetchVitals, 5000) // Update every 5s

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-12 max-w-7xl mx-auto font-mono">
        <div className="animate-pulse text-primary text-center">
          INITIALIZING_DIAGNOSTIC_SYSTEMS...
        </div>
      </div>
    )
  }

  return (
    <div className="p-12 max-w-7xl mx-auto font-mono text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
          <h1 className="text-3xl font-bold text-primary">SYSTEM_VITALS.MONITOR</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          &gt; REAL-TIME_DIAGNOSTIC_INTERFACE • UPDATED_{new Date(vitals?.timestamp || Date.now()).toLocaleTimeString()}
        </p>
      </div>

      {/* Main Monitor - ECG FULL WIDTH! */}
      <div className="mb-6">
        {/* ECG Monitor - HERO SECTION */}
        <div className="relative">
          <HeartbeatMonitor 
            bpm={vitals?.vitals.heartbeat.bpm || 75}
            label="POLYMARKET_PULSE"
            color="#00ff00"
          />
          
          {/* Volume Display under ECG */}
          <div className="mt-4 bg-black border-2 border-primary/30 rounded-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-primary/50 text-xs mb-1 uppercase tracking-wider">24H_VOLUME</div>
                <div className="text-primary text-3xl font-bold tabular-nums">
                  ${((vitals?.vitals.heartbeat.volume24h || 0) / 1_000_000).toFixed(2)}M
                </div>
              </div>
              <div>
                <div className="text-primary/50 text-xs mb-1 uppercase tracking-wider">CHANGE_24H</div>
                <div className={`text-3xl font-bold ${
                  vitals?.vitals.heartbeat.volumeChange
                    ? vitals.vitals.heartbeat.volumeChange.startsWith('-')
                      ? 'text-red-400'
                      : 'text-green-400'
                    : 'text-primary/50'
                }`}>
                  {vitals?.vitals.heartbeat.volumeChange || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-primary/50 text-xs mb-1 uppercase tracking-wider">HEARTBEAT</div>
                <div className="text-primary text-3xl font-bold tabular-nums">
                  {vitals?.vitals.heartbeat.bpm || 0} <span className="text-xl text-primary/50">BPM</span>
                </div>
              </div>
              <div>
                <div className="text-primary/50 text-xs mb-1 uppercase tracking-wider">STATUS</div>
                <div className="text-green-400 text-3xl font-bold">
                  LIVE
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">

        {/* Vital Signs Panel */}
        <div className="bg-black border-2 border-primary/30 rounded-sm p-4 lg:col-span-1">
          <div className="text-primary text-sm mb-4 border-b border-primary/30 pb-2 uppercase tracking-wider">
            VITAL_SIGNS
          </div>
          
          <div className="space-y-4">
            {/* Markets */}
            <div className="flex items-center justify-between group hover:bg-primary/5 p-2 rounded transition-all">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary group-hover:animate-pulse" />
                <span className="text-sm text-primary/70">MARKETS</span>
              </div>
              <div className="text-right">
                <div className="text-primary text-xl font-bold tabular-nums group-hover:text-green-400 transition-colors">
                  {vitals?.vitals.markets.active || 0}
                </div>
                <div className="text-primary/50 text-[10px]">ACTIVE</div>
              </div>
            </div>

            {/* Traders */}
            <div className="flex items-center justify-between group hover:bg-primary/5 p-2 rounded transition-all">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary group-hover:animate-pulse" />
                <span className="text-sm text-primary/70">TRADERS</span>
              </div>
              <div className="text-right">
                <div className="text-primary text-xl font-bold tabular-nums group-hover:text-green-400 transition-colors">
                  {vitals?.vitals.traders.total || 0}
                </div>
                <div className="text-primary/50 text-[10px]">
                  S:{vitals?.vitals.traders.sTier || 0} A:{vitals?.vitals.traders.aTier || 0} B:{vitals?.vitals.traders.bTier || 0}
                </div>
              </div>
            </div>

            {/* Liquidity */}
            <div className="flex items-center justify-between group hover:bg-primary/5 p-2 rounded transition-all">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary group-hover:animate-pulse" />
                <span className="text-sm text-primary/70">LIQUIDITY</span>
              </div>
              <div className="text-right">
                <div className="text-primary text-xl font-bold tabular-nums group-hover:text-green-400 transition-colors">
                  ${((vitals?.vitals.markets.liquidity || 0) / 1_000_000).toFixed(1)}M
                </div>
                <div className="text-primary/50 text-[10px]">TOTAL</div>
              </div>
            </div>

            {/* Status */}
            <div className="mt-4 pt-4 border-t border-primary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                  <span className="text-green-400 text-sm font-bold">
                    {vitals?.vitals.performance.status || 'HEALTHY'}
                  </span>
                </div>
                <div className="text-primary/50 text-[10px]">
                  SYSTEM_OK
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics - In same grid! */}
        {/* API Response */}
        <div className="bg-black border-2 border-primary/30 rounded-sm p-4 hover:border-primary/60 transition-all group">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary group-hover:animate-spin" />
            <span className="text-primary text-sm">API_RESPONSE</span>
          </div>
          <div className="text-primary text-3xl font-bold tabular-nums group-hover:text-green-400 transition-all">
            {vitals?.vitals.performance.apiResponseTime || 0}
            <span className="text-lg text-primary/50 ml-1">ms</span>
          </div>
          <div className={`text-xs mt-2 flex items-center gap-2 ${
            (vitals?.vitals.performance.apiResponseTime || 0) < 100 
              ? 'text-green-400' 
              : 'text-yellow-400'
          }`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {(vitals?.vitals.performance.apiResponseTime || 0) < 100 ? '✓ FAST' : '⚠ MODERATE'}
          </div>
        </div>

        {/* Database */}
        <div className="bg-black border-2 border-primary/30 rounded-sm p-4 hover:border-primary/60 transition-all group">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-primary group-hover:animate-pulse" />
            <span className="text-primary text-sm">DATABASE_PING</span>
          </div>
          <div className="text-primary text-3xl font-bold tabular-nums group-hover:text-green-400 transition-all">
            {vitals?.vitals.performance.dbPingTime || 0}
            <span className="text-lg text-primary/50 ml-1">ms</span>
          </div>
          <div className="text-green-400 text-xs mt-2 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
            ✓ CONNECTED
          </div>
        </div>

        {/* System Status */}
        <div className="bg-black border-2 border-primary/30 rounded-sm p-4 hover:border-green-400/60 transition-all group">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary group-hover:text-green-400 group-hover:animate-pulse" />
            <span className="text-primary text-sm group-hover:text-green-400 transition-colors">OVERALL_STATUS</span>
          </div>
          <div className="text-green-400 text-3xl font-bold group-hover:animate-pulse">
            {vitals?.status.toUpperCase() || 'HEALTHY'}
          </div>
          <div className="text-primary/50 text-xs mt-2 group-hover:text-green-400/70 transition-colors">
            All systems operational
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-black border-2 border-primary/30 rounded-sm p-4">
        <div className="text-primary text-sm mb-2 uppercase tracking-wider">
          SYNC_STATUS
        </div>
        <div className="text-xs text-muted-foreground">
          LEADERBOARD_LAST_SYNC:{' '}
          <span className="text-white font-mono">
            {vitals?.vitals.sync.leaderboardLastSync
              ? new Date(vitals.vitals.sync.leaderboardLastSync).toLocaleString()
              : 'N/A'}
          </span>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-6 bg-card pixel-border border-primary/30 p-4">
        <p className="text-xs text-muted-foreground font-mono">
          ⚡ DIAGNOSTIC_MODE: Metrics update every 5 seconds • BPM calculated from 24h volume ($1M = 1 BPM) • Volume change is best-effort from last sample
        </p>
      </div>
    </div>
  )
}

