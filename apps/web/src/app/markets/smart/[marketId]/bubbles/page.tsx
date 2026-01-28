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
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/markets/smart/${marketId}`}
            className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-mono">BACK TO MARKET</span>
          </Link>
          
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="text-purple-400">🫧</span> Whale Network Graph
          </h1>
          <p className="text-muted-foreground text-sm font-mono">
            Interactive visualization of all whale trades • Click any bubble to view on Polymarket
          </p>
        </div>

        {/* Graph */}
        <Suspense fallback={
          <div className="flex items-center justify-center h-[600px] bg-card pixel-border border-purple-500/40 p-6">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        }>
          <WhaleNetworkGraph marketId={marketId} minAmount={100} />
        </Suspense>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-black/60 pixel-border border-green-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-sm font-bold text-green-400 font-mono">YES WHALES</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Green bubbles = wallets buying YES. Larger = more volume.
            </p>
          </div>

          <div className="bg-black/60 pixel-border border-red-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-sm font-bold text-red-400 font-mono">NO WHALES</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Red bubbles = wallets buying NO. Larger = more volume.
            </p>
          </div>

          <div className="bg-black/60 pixel-border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-purple-400" />
              <span className="text-sm font-bold text-purple-400 font-mono">CONNECTIONS</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Lines show market dynamics between YES/NO whales.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
