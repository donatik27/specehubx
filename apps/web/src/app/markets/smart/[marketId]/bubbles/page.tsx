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
      {/* Floating Back Button (Top Left) */}
      <Link 
        href={`/markets/smart/${marketId}`}
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 px-3 py-2 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 text-purple-400 hover:text-purple-300 hover:border-purple-400/60 transition-all text-sm font-mono"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>BACK</span>
      </Link>

      {/* Floating Legend (Top Right) */}
      <div className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm pixel-border border-purple-500/40 p-3 w-64">
        <div className="text-xs font-mono space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500" />
            <span className="text-purple-400 font-bold">MARKET HUB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-green-400">YES whales (left)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-red-400">NO whales (right)</span>
          </div>
          <div className="text-[10px] text-purple-400/80 mt-2 pt-2 border-t border-purple-500/20">
            🐋 Top 50 whales • Min $1K
          </div>
          <div className="text-[10px] text-muted-foreground">
            💡 Drag to pan • Scroll to zoom • Click bubble
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
