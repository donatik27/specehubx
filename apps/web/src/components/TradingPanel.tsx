'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { WalletConnectButton } from './WalletConnect'
import { ApprovalButton } from './ApprovalButton'
import { ethers } from 'ethers'
import { checkUSDCAllowance } from '@/lib/usdc-approval'

interface TradingPanelProps {
  marketId: string
  question: string
  yesPrice: number
  noPrice: number
  yesTokenId?: string
  noTokenId?: string
}

export function TradingPanel({
  marketId,
  question,
  yesPrice,
  noPrice,
  yesTokenId,
  noTokenId,
}: TradingPanelProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [side, setSide] = useState<'YES' | 'NO'>('YES')
  const [amount, setAmount] = useState('10')
  const [loading, setLoading] = useState(false)
  const [hasAllowance, setHasAllowance] = useState(false)
  const [checkingAllowance, setCheckingAllowance] = useState(true)

  useEffect(() => {
    if (isConnected && address) {
      checkApproval()
    }
  }, [isConnected, address])

  const checkApproval = async () => {
    if (!address) return
    
    try {
      setCheckingAllowance(true)
      const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com')
      const allowance = await checkUSDCAllowance(address, provider)
      setHasAllowance(allowance > 0n)
    } catch (err) {
      console.error('Error checking allowance:', err)
      setHasAllowance(false)
    } finally {
      setCheckingAllowance(false)
    }
  }

  const currentPrice = side === 'YES' ? yesPrice : noPrice
  const shares = parseFloat(amount) / currentPrice
  const potentialWin = shares * (1 - currentPrice)

  const handleTrade = async () => {
    if (!isConnected || !address || !walletClient) {
      alert('Please connect your wallet first!')
      return
    }

    if (!hasAllowance) {
      alert('Please approve USDC first!')
      return
    }

    setLoading(true)
    try {
      // Import Polymarket trading functions
      const { placePolymarketOrder } = await import('@/lib/polymarket-trading')
      
      // Create ethers signer from wagmi wallet client
      const provider = new ethers.providers.Web3Provider(walletClient as any)
      const signer = provider.getSigner()

      // Get token ID
      const tokenID = side === 'YES' ? yesTokenId : noTokenId
      if (!tokenID) {
        throw new Error('Token ID not available for this market')
      }

      // Place real order on Polymarket!
      // This will trigger MetaMask popup for signature
      // We're always BUYING shares (YES or NO based on tokenID)
      const result = await placePolymarketOrder(signer, {
        tokenID,
        price: currentPrice,
        side: 'BUY', // Always BUY shares (selling would be different flow)
        size: parseFloat(amount),
      })

      if (result.success) {
        alert(`✅ Order placed successfully on Polymarket!\n\nOrder ID: ${result.orderID}\nSide: ${side}\nAmount: $${amount}\n\nView on: polymarket.com/portfolio`)
      } else {
        throw new Error(result.error || 'Order placement failed')
      }
    } catch (error: any) {
      console.error('Trade failed:', error)
      alert(`❌ Trade failed: ${error.message}\n\nPlease check:\n- USDC balance sufficient\n- Polygon network selected\n- Try refreshing the page`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card pixel-border border-primary/40 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">💱</div>
          <h3 className="text-xl font-bold text-primary uppercase tracking-wider">
            Place_Order
          </h3>
        </div>

      {!isConnected ? (
        <div className="mb-4">
          <WalletConnectButton />
        </div>
      ) : (
        <div className="mb-4 bg-black/40 pixel-border border-primary/30 p-4">
          <ApprovalButton />
        </div>
      )}
      </div>

      {/* YES/NO Selection */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSide('YES')}
          disabled={loading}
          className={`py-4 font-bold pixel-border transition-all ${
            side === 'YES'
              ? 'bg-green-500 text-black border-green-500'
              : 'bg-black/40 text-white border-white/20 hover:border-green-500/50'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <TrendingUp className="inline h-5 w-5 mr-2" />
          <div className="text-lg">YES</div>
          <div className="text-sm opacity-80">{(yesPrice * 100).toFixed(1)}¢</div>
        </button>

        <button
          onClick={() => setSide('NO')}
          disabled={loading}
          className={`py-4 font-bold pixel-border transition-all ${
            side === 'NO'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-black/40 text-white border-white/20 hover:border-red-500/50'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <TrendingDown className="inline h-5 w-5 mr-2" />
          <div className="text-lg">NO</div>
          <div className="text-sm opacity-80">{(noPrice * 100).toFixed(1)}¢</div>
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm text-muted-foreground mb-2 font-mono uppercase tracking-wider">
          Amount (USDC)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
          className="w-full bg-black/60 border border-primary/40 px-4 py-3 text-white font-mono text-lg focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="10"
          min="1"
          step="1"
        />
      </div>

      {/* Trade Summary */}
      <div className="bg-black/40 pixel-border border-white/10 p-4 mb-6 space-y-3 text-sm font-mono">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground uppercase">Price:</span>
          <span className="text-white font-bold">{(currentPrice * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground uppercase">Shares:</span>
          <span className="text-white font-bold">{shares.toFixed(2)}</span>
        </div>
        <div className="border-t border-white/10 pt-3"></div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground uppercase">Potential Win:</span>
          <span className="text-green-400 font-bold">+${potentialWin.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground uppercase">Max Loss:</span>
          <span className="text-red-400 font-bold">-${amount}</span>
        </div>
      </div>

      {/* Submit Button */}
      {isConnected ? (
        <button
          onClick={handleTrade}
          disabled={loading || parseFloat(amount) <= 0 || !hasAllowance || checkingAllowance}
          className={`w-full py-4 font-bold pixel-border transition-all uppercase tracking-wider text-base ${
            side === 'YES'
              ? 'bg-green-500 text-black hover:bg-green-400'
              : 'bg-red-500 text-white hover:bg-red-400'
          } ${
            loading || parseFloat(amount) <= 0 || !hasAllowance || checkingAllowance
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="inline h-5 w-5 mr-2 animate-spin" />
              Placing_Order...
            </>
          ) : checkingAllowance ? (
            <>
              <Loader2 className="inline h-5 w-5 mr-2 animate-spin" />
              Checking_Approval...
            </>
          ) : !hasAllowance ? (
            '⚠️ Approve USDC First'
          ) : (
            `2️⃣ Buy ${side} Shares`
          )}
        </button>
      ) : (
        <div className="text-center py-6 text-muted-foreground font-mono text-sm">
          <p className="mb-2">→ CONNECT_WALLET_TO_TRADE ←</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-primary/10 pixel-border border-primary/30 text-xs text-primary font-mono">
        🚀 REAL TRADING: Orders placed on Polymarket!
      </div>
    </div>
  )
}
