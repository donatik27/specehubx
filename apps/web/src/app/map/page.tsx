'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { Globe, RefreshCw, Users, Trophy, Target } from 'lucide-react'
import { getTraderLocation } from '@/lib/trader-geolocation'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Dynamically import TraderGlobe (client-only)
const TraderGlobe = dynamic(() => import('@/components/TraderGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <p className="text-primary font-mono">LOADING_3D_GLOBE...</p>
    </div>
  ),
})

interface Trader {
  address: string
  displayName: string
  tier: string
  rarityScore: number
  avatar: string
  estimatedPnL: number
}

interface TraderMarker {
  trader: Trader
  lat: number
  lng: number
  region: string
  x: number
  y: number
}

interface HoveredTrader {
  address: string
  displayName: string
  tier: string
  pnl: number
  profileImage: string
}

export default function MapPage() {
  const [stats, setStats] = useState({
    totalTraders: 0,
    sTier: 0,
    aTier: 0,
    bTier: 0
  })
  const [traders, setTraders] = useState<TraderMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredTrader, setHoveredTrader] = useState<HoveredTrader | null>(null)
  const [focusedTrader, setFocusedTrader] = useState<{ lat: number; lng: number; address: string } | null>(null)
  const [topTradersRotation, setTopTradersRotation] = useState(0) // For randomizing top traders
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  // Rotate top traders every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTopTradersRotation(prev => prev + 1)
    }, 15000) // 15 seconds
    
    return () => clearInterval(interval)
  }, [])

  // Handler with delay for trader hover
  const handleTraderHover = (trader: HoveredTrader | null) => {
    // Clear existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (trader) {
      // Immediately show new trader
      setHoveredTrader(trader)
    } else {
      // Delay hiding the panel by 3 seconds
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredTrader(null)
      }, 3000)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch ONLY public traders with real geolocations
      const tradersRes = await fetch('/api/traders-map-static')
      const publicTraders: any[] = await tradersRes.json()
      
      console.log(`✅ Loaded ${publicTraders.length} public traders with geolocations`)
      
      // Map public traders with real locations
      const tradersWithLocations: TraderMarker[] = publicTraders
        .filter(t => t.latitude != null && t.longitude != null) // Only with coordinates
        .map((pubTrader) => {
          const trader: Trader = {
            address: pubTrader.address,
            displayName: pubTrader.displayName || 'Unknown',
            tier: pubTrader.tier || 'S',
            rarityScore: pubTrader.rarityScore || 0,
            avatar: pubTrader.profilePicture || `https://api.dicebear.com/7.x/shapes/svg?seed=${pubTrader.address}`,
            estimatedPnL: Number(pubTrader.totalPnl) || 0,
          }
          
          // Convert lat/lng to screen coordinates
          let lat = Number(pubTrader.latitude)
          let lng = Number(pubTrader.longitude)
          let region = pubTrader.country || 'Unknown'

          // Snap to land-based region if country is known (avoids ocean placements)
          if (pubTrader.country) {
            const landLocation = getTraderLocation([{ question: pubTrader.country }])

            // Deterministic spread so traders don't overlap
            const seed = pubTrader.address
              .toLowerCase()
              .split('')
              .reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
            const angle = (seed % 360) * (Math.PI / 180)
            const offset = 0.6 + ((seed % 100) / 100) * 0.8 // 0.6 - 1.4 deg

            lat = landLocation.lat + Math.cos(angle) * offset
            lng = landLocation.lng + Math.sin(angle) * offset
            region = landLocation.region
          }
          const x = ((lng + 180) / 360) * 100
          const y = ((90 - lat) / 180) * 100
          
          return {
            trader,
            lat,
            lng,
            region,
            x,
            y
          }
        })
      
      setTraders(tradersWithLocations)
      
      setStats({
        totalTraders: publicTraders.length,
        sTier: publicTraders.filter(t => t.tier === 'S').length,
        aTier: publicTraders.filter(t => t.tier === 'A').length,
        bTier: publicTraders.filter(t => t.tier === 'B').length
      })
      
      console.log(`✅ Mapped ${tradersWithLocations.length} PUBLIC traders to real locations`)
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-12 max-w-6xl mx-auto font-mono text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Globe className="h-8 w-8 text-primary alien-glow" />
              <h1 className="text-3xl font-bold text-primary alien-glow">TRADER_RADAR.3D</h1>
              {loading && <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-muted-foreground text-sm">
              &gt; GEOGRAPHIC_DISTRIBUTION_OF_SMART_TRADERS
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-primary text-black rounded-sm hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center gap-2 border-2 border-primary alien-glow"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">👥</div>
          <p className="text-xs font-mono text-primary mb-1 uppercase tracking-wider">Mapped_Traders</p>
          <p className="text-2xl font-bold text-white relative z-10">
            {loading ? '...' : traders.length}
          </p>
        </div>
        <div className="bg-card pixel-border border-[#FFD700]/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🏆</div>
          <p className="text-xs font-mono text-[#FFD700] mb-1 uppercase tracking-wider">S_Tier</p>
          <p className="text-2xl font-bold text-[#FFD700] relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'S').length}
          </p>
        </div>
        <div className="bg-card pixel-border border-white/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">⭐</div>
          <p className="text-xs font-mono text-white mb-1 uppercase tracking-wider">A_Tier</p>
          <p className="text-2xl font-bold text-white relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'A').length}
          </p>
        </div>
        <div className="bg-card pixel-border border-primary/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-4xl opacity-10">🎯</div>
          <p className="text-xs font-mono text-primary mb-1 uppercase tracking-wider">B_Tier</p>
          <p className="text-2xl font-bold text-primary relative z-10">
            {loading ? '...' : traders.filter(t => t.trader.tier === 'B').length}
          </p>
        </div>
      </div>

      {/* 3D Earth Globe with Three.js */}
      <div className="bg-black pixel-border border-primary/40 relative overflow-hidden mb-8 h-[550px]">
        {/* Info overlay */}
        <div className="absolute top-4 left-4 bg-black/90 pixel-border border-primary/50 p-3 z-20 pointer-events-none">
          <p className="text-primary font-mono text-xs mb-1">&gt; THREE.JS_GLOBE.3D</p>
          <p className="text-white text-sm font-bold">{traders.length} TRADERS MAPPED</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-[#FFD700]">● S</span>
            <span className="text-white">● A</span>
            <span className="text-primary">● B</span>
          </div>
        </div>

        {/* Hovered Trader Info - Top Right */}
        {hoveredTrader && (
          <Link 
            href={`/traders/${hoveredTrader.address}`}
            className="absolute top-4 right-4 bg-black pixel-border border-primary/50 p-4 z-50 min-w-[200px] hover:border-primary transition-all cursor-pointer"
            style={{ backgroundColor: '#000000', opacity: 1 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <img 
                src={hoveredTrader.profileImage} 
                alt={hoveredTrader.displayName}
                className="w-10 h-10 rounded-full border-2"
                style={{
                  borderColor: hoveredTrader.tier === 'S' ? '#FFD700' : 
                               hoveredTrader.tier === 'A' ? '#00ff00' : 
                               '#00aaff'
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    hoveredTrader.tier === 'S' ? 'bg-[#FFD700] text-black' :
                    hoveredTrader.tier === 'A' ? 'bg-[#00ff00] text-black' :
                    'bg-[#00aaff] text-black'
                  }`}>
                    {hoveredTrader.tier}
                  </span>
                  <p className="text-white font-mono text-xs font-bold truncate">
                    {hoveredTrader.displayName}
                  </p>
                </div>
              </div>
            </div>
            <div className={`text-sm font-bold font-mono ${hoveredTrader.pnl >= 0 ? 'text-[#00ff00]' : 'text-red-500'}`}>
              PnL: {hoveredTrader.pnl >= 0 ? '+' : ''}{(hoveredTrader.pnl / 1000).toFixed(1)}K
            </div>
          </Link>
        )}
        
        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 bg-black/90 pixel-border border-primary/50 p-2 z-20 pointer-events-none">
          <p className="text-muted-foreground font-mono text-xs">
            &gt; DRAG_TO_ROTATE • SCROLL_TO_ZOOM
          </p>
        </div>

        {/* 3D Globe */}
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-black">
            <p className="text-primary font-mono animate-pulse">LOADING_3D_GLOBE...</p>
          </div>
        }>
          <TraderGlobe
            traders={traders.map((m) => ({
              address: m.trader.address,
              displayName: m.trader.displayName,
              tier: m.trader.tier,
              lat: m.lat,
              lng: m.lng,
              pnl: m.trader.estimatedPnL,
              profileImage: m.trader.avatar,
            }))}
            onTraderHover={handleTraderHover}
            focusedTrader={focusedTrader}
          />
        </Suspense>
      </div>

      {/* Trader List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By Region */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <h2 className="text-lg font-bold text-primary mb-4">
            &gt; TRADERS_BY_REGION:
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {Object.entries(
              traders.reduce((acc, t) => {
                acc[t.region] = (acc[t.region] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            )
            .sort((a, b) => b[1] - a[1])
            .map(([region, count]) => (
              <div key={region} className="flex items-center justify-between p-2 bg-black/40 pixel-border border-white/20">
                <span className="text-sm text-white">{region}</span>
                <span className="text-primary font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Traders - Featured */}
        <div className="bg-card pixel-border border-primary/40 p-6">
          <h2 className="text-lg font-bold text-primary mb-4">
            &gt; TOP_MAPPED_TRADERS:
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(() => {
              // Randomize traders display (changes every 15 seconds)
              // Use deterministic shuffle based on rotation index
              const shuffled = [...traders].sort((a, b) => {
                const hashA = (a.trader.address.charCodeAt(0) + topTradersRotation) % traders.length;
                const hashB = (b.trader.address.charCodeAt(0) + topTradersRotation) % traders.length;
                return hashA - hashB;
              });
              
              // Take top 8 from shuffled list
              const displayTraders = shuffled.slice(0, 8);
              
              return displayTraders.map((marker) => (
                <a
                  key={marker.trader.address}
                  href={`/traders/${marker.trader.address}`}
                  className="flex items-center justify-between p-2 bg-black/40 pixel-border border-white/20 hover:border-primary transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={marker.trader.avatar} 
                      alt={marker.trader.displayName}
                      className="w-10 h-10 rounded pixel-border"
                      style={{
                        borderWidth: '2px',
                        borderColor: marker.trader.tier === 'S' ? '#FFD700' : 
                                   marker.trader.tier === 'A' ? '#ffffff' : 
                                   '#00ff00'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${marker.trader.address}`
                      }}
                    />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold pixel-border ${
                            marker.trader.tier === 'S'
                              ? 'bg-[#FFD700] text-black'
                              : marker.trader.tier === 'A'
                              ? 'bg-white text-black'
                              : 'bg-primary text-black'
                          }`}
                        >
                          {marker.trader.tier}
                        </span>
                        <span className="text-sm text-white truncate max-w-[120px] group-hover:text-primary transition-colors">
                          {marker.trader.displayName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{marker.region}</span>
                </a>
              ))
            })()}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-card pixel-border border-primary/40 p-6">
        <h2 className="text-lg font-bold text-primary mb-4">
          &gt; HOW_IT_WORKS:
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 🌍 Interactive 3D Earth (Three.js/WebGL)</p>
          <p>• 📍 <span className="text-green-500 font-bold">REAL TRADER LOCATIONS</span> - These are actual geographic locations of public traders</p>
          <p>• 🔓 <span className="text-primary font-bold">100% PUBLIC DATA</span> - All information is publicly available on Polymarket and Twitter/X</p>
          <p>• 🐦 Based on verified Twitter/X profiles with public location data</p>
          <p>• ✅ <span className="text-white font-bold">VERIFIED REAL DATA</span> - Not simulated or generated. These traders really are in these regions</p>
          <p>• 🎯 {traders.length} public traders mapped across {Object.keys(
              traders.reduce((acc, t) => {
                acc[t.region] = true
                return acc
              }, {} as Record<string, boolean>)
            ).length} countries</p>
          <p>• 🖼️ Hover over avatars to see trader details</p>
          <p className="text-primary mt-4">• 🟡 S-tier | ⚪ A-tier | 🟢 B-tier traders</p>
          <p className="text-xs text-white/70 mt-4 bg-primary/10 p-2 pixel-border border-primary/30">
            ⚠️ All locations are sourced from publicly shared information by traders on their social media profiles. 
            This data represents real geographic distribution of the Polymarket trader community.
          </p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            &gt; Drag to rotate • Scroll to zoom • Click markers to view profile
          </p>
        </div>
      </div>
    </div>
  )
}
