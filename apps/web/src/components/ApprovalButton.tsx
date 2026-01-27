'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { ethers } from 'ethers'
import { checkUSDCAllowance, approveUSDC, formatUSDC, getUSDCBalance } from '@/lib/usdc-approval'

export function ApprovalButton() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const [checking, setChecking] = useState(true)
  const [hasAllowance, setHasAllowance] = useState(false)
  const [approving, setApproving] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState<string>('0')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isConnected && address) {
      checkAllowance()
      checkBalance()
    }
  }, [isConnected, address])

  const checkAllowance = async () => {
    if (!address) return
    
    try {
      setChecking(true)
      const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com')
      const allowance = await checkUSDCAllowance(address, provider)
      
      // If allowance > 0, user has approved
      setHasAllowance(allowance > 0n)
    } catch (err) {
      console.error('Error checking allowance:', err)
      setHasAllowance(false)
    } finally {
      setChecking(false)
    }
  }

  const checkBalance = async () => {
    if (!address) return
    
    try {
      const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com')
      const balance = await getUSDCBalance(address, provider)
      setUsdcBalance(formatUSDC(balance))
    } catch (err) {
      console.error('Error checking balance:', err)
    }
  }

  const handleApprove = async () => {
    if (!walletClient) {
      setError('Wallet not connected')
      return
    }

    setApproving(true)
    setError(null)

    try {
      // Create ethers signer from wagmi wallet client
      const provider = new ethers.providers.Web3Provider(walletClient as any)
      const signer = provider.getSigner()

      // Approve USDC
      const tx = await approveUSDC(signer)
      
      // Wait for confirmation
      await tx.wait()
      
      // Recheck allowance
      await checkAllowance()
      
      alert('✅ USDC Approved! You can now place orders.')
    } catch (err: any) {
      console.error('Approval error:', err)
      setError(err.message || 'Approval failed')
    } finally {
      setApproving(false)
    }
  }

  if (!isConnected) return null

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking approval...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Balance Display */}
      <div className="flex items-center justify-between text-sm font-mono">
        <span className="text-muted-foreground">USDC Balance:</span>
        <span className="text-white font-bold">${usdcBalance}</span>
      </div>

      {/* Approval Status */}
      {hasAllowance ? (
        <div className="flex items-center gap-2 text-sm text-green-500 font-mono">
          <CheckCircle className="h-4 w-4" />
          USDC Approved ✅
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-yellow-500 font-mono">
            <AlertCircle className="h-4 w-4" />
            Approval Required
          </div>
          
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold pixel-border transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approving ? (
              <>
                <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              '1️⃣ Approve USDC'
            )}
          </button>
          
          <p className="text-xs text-muted-foreground font-mono text-center">
            One-time approval to trade on Polymarket
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-500 font-mono bg-red-500/10 p-2 pixel-border border-red-500/30">
          ❌ {error}
        </div>
      )}
    </div>
  )
}
