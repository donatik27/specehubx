'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Dynamically import WhaleNetworkGraph to avoid SSR issues
const WhaleNetworkGraph = dynamic(
  () => import('@/components/WhaleNetworkGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[600px] bg-card pixel-border border-purple-500/40 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        <span className="ml-3 text-sm text-muted-foreground">Loading whale network...</span>
      </div>
    )
  }
)

export default function BubblesPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const marketId = params.marketId as string
  const focusAddress = searchParams.get('focus')

  return (
    <div className="fixed inset-0 bg-black">
      {/* Floating Back Button (Next to SpaceHub logo) */}
      <Link 
        href={`/markets/smart/${marketId}`}
        className="fixed top-4 left-56 z-50 inline-flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-sm pixel-border border-purple-500/50 text-purple-400 hover:text-white hover:bg-purple-600 hover:border-purple-400 transition-all text-sm font-bold font-mono shadow-lg shadow-purple-500/20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>BACK TO MARKET</span>
      </Link>

      {/* Enhanced Legend Panel (Top Right) */}
      <div className="fixed top-4 right-4 z-50 bg-black/90 backdrop-blur-sm pixel-border border-purple-500/50 p-4 w-72 shadow-xl shadow-purple-500/20">
        <div className="text-xs font-mono space-y-3">
          {/* Header */}
          <div className="text-purple-400 font-bold text-sm mb-3 pb-2 border-b border-purple-500/30">
            🫧 WHALE NETWORK GRAPH
          </div>
          
          {/* Hub */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-purple-400 shadow-lg shadow-purple-500/50" />
            <span className="text-purple-300 font-bold">Market Hub</span>
          </div>
          
          {/* Sides */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400" />
              <span className="text-green-400 font-medium">YES Whales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-400" />
              <span className="text-red-400 font-medium">NO Whales</span>
            </div>
          </div>
          
          {/* Tiers */}
          <div className="pt-2 border-t border-purple-500/20">
            <div className="text-[10px] text-purple-400/80 font-bold mb-2">WHALE TIERS:</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400 font-black text-[8px] flex items-center justify-center text-black">S</div>
                <span className="text-yellow-400 font-bold">S-Tier</span>
                <span className="text-muted-foreground text-[10px]">Top 15%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-400 font-black text-[8px] flex items-center justify-center text-black">A</div>
                <span className="text-purple-400 font-bold">A-Tier</span>
                <span className="text-muted-foreground text-[10px]">16-50%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400 font-black text-[8px] flex items-center justify-center text-black">B</div>
                <span className="text-blue-400 font-bold">B-Tier</span>
                <span className="text-muted-foreground text-[10px]">50%+</span>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="text-[10px] text-purple-400/80 pt-2 border-t border-purple-500/20">
            📊 Top 50 whales • Min $1K trades
          </div>
          
          {/* Controls */}
          <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-purple-500/20">
            <div>🖱️ <span className="text-purple-400">Drag</span> bubbles/hub to move</div>
            <div>🔍 <span className="text-purple-400">Scroll</span> to zoom in/out</div>
            <div>👆 <span className="text-purple-400">Double-click</span> to open profile</div>
            <div>✋ <span className="text-purple-400">Pan</span> canvas by dragging empty space</div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN Graph */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <span className="ml-3 text-sm text-muted-foreground">Loading network...</span>
        </div>
      }>
        <WhaleNetworkGraph marketId={marketId} minAmount={1000} />
      </Suspense>
    </div>
  )
}
