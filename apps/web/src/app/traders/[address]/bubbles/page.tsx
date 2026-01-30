'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Dynamically import TraderBubblesGraph to avoid SSR issues
const TraderBubblesGraph = dynamic(
  () => import('@/components/TraderBubblesGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-400" />
        <span className="ml-3 text-sm text-muted-foreground">Loading position bubbles...</span>
      </div>
    )
  }
)

export default function TraderBubblesPage() {
  const params = useParams()
  const address = params?.address as string

  return (
    <div className="fixed inset-0 bg-black">
      {/* Floating Back Button */}
      <Link 
        href={`/traders/${address}`}
        className="fixed top-4 left-56 z-50 inline-flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-sm pixel-border border-green-500/50 text-green-400 hover:text-white hover:bg-green-600 hover:border-green-400 transition-all text-sm font-bold font-mono shadow-lg shadow-green-500/20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>BACK TO PROFILE</span>
      </Link>

      {/* Enhanced Legend Panel (Top Right) */}
      <div className="fixed top-4 right-4 z-50 bg-black/90 backdrop-blur-sm pixel-border border-green-500/50 p-4 w-72 shadow-xl shadow-green-500/20">
        <div className="text-xs font-mono space-y-3">
          {/* Header */}
          <div className="text-green-400 font-bold text-sm mb-3 pb-2 border-b border-green-500/30">
            🫧 POSITION BUBBLES
          </div>
          
          {/* Hub */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 border-2 border-green-400 shadow-lg shadow-green-500/50" />
            <span className="text-green-300 font-bold">Trader Hub</span>
          </div>
          
          {/* Position Types */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-400" />
              <span className="text-green-400 font-medium">Profitable (+$)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-400" />
              <span className="text-red-400 font-medium">Losing (-$)</span>
            </div>
          </div>
          
          {/* Stats */}
          <div className="text-[10px] text-green-400/80 pt-2 border-t border-green-500/20">
            📊 Real-time P&L • Open positions only
          </div>
          
          {/* Controls */}
          <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-green-500/20">
            <div>🖱️ <span className="text-green-400">Drag</span> bubbles/hub to move</div>
            <div>🔍 <span className="text-green-400">Scroll</span> to zoom in/out</div>
            <div>👆 <span className="text-green-400">Click</span> bubble for details</div>
            <div>✋ <span className="text-green-400">Pan</span> canvas by dragging</div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN Graph */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-green-400" />
          <span className="ml-3 text-sm text-muted-foreground">Loading network...</span>
        </div>
      }>
        <TraderBubblesGraph address={address} />
      </Suspense>
    </div>
  )
}
