'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { ethers } from 'ethers'
import { checkUSDCAllowance, approveUSDC, formatUSDC, getUSDCBalance } from '@/lib/usdc-approval'

const RPC_URLS = [
  'https://polygon.llamarpc.com',
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon',
  'https://polygon-bor.publicnode.com',
]

export function ApprovalButton() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const [checking, setChecking] = useState(true)
  const [hasAllowance, setHasAllowance] = useState(false)
  const [approving, setApproving] = useState(false)
  const [usdcBalance, setUsdcBalance] = useState<string>('0')
  const [error, setError] = useState<string | null>(null)
  const [approvalConfirmed, setApprovalConfirmed] = useState(false) // NEW: Track if approval was done in this session

  const getReadProvider = async () => {
    if (walletClient) {
      return new ethers.providers.Web3Provider(walletClient as any)
    }

    for (const url of RPC_URLS) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(url)
        await provider.getBlockNumber()
        return provider
      } catch (err) {
        console.warn('RPC failed:', url, err)
      }
    }

    throw new Error('No available Polygon RPC endpoints')
  }

  useEffect(() => {
    if (isConnected && address && !approvalConfirmed) {
      // Only check if we haven't just approved
      checkAllowance()
      checkBalance()
    }
  }, [isConnected, address])

  const checkAllowance = async () => {
    if (!address) return
    
    // Check localStorage first - if user approved before, trust it
    const stored = localStorage.getItem(`usdc_approved_${address}`)
    if (stored === 'true') {
      console.log('✅ Found approval in localStorage - skipping RPC check')
      setHasAllowance(true)
      setApprovalConfirmed(true)
      setChecking(false)
      return
    }
    
    try {
      setChecking(true)
      const provider = await getReadProvider()
      const allowance = await checkUSDCAllowance(address, provider)
      
      console.log('🔍 Allowance check:', allowance.toString())
      
      // If allowance > 0, user has approved
      const approved = allowance > 0n
      setHasAllowance(approved)
      
      // Store in localStorage if approved
      if (approved && address) {
        localStorage.setItem(`usdc_approved_${address}`, 'true')
        setApprovalConfirmed(true)
      }
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
      const provider = await getReadProvider()
      const balance = await getUSDCBalance(address, provider)
      setUsdcBalance(formatUSDC(balance))
      console.log(`✅ USDC Balance: $${formatUSDC(balance)}`)
    } catch (err) {
      console.error('Error checking balance:', err)
      setError('RPC error: Unable to fetch USDC balance. Try refreshing.')
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
      console.log('📝 Approval tx sent:', tx.hash)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      console.log('✅ Approval confirmed in block:', receipt.blockNumber)
      
      // Set approved immediately (don't wait for RPC to update)
      setHasAllowance(true)
      setApprovalConfirmed(true) // Mark approval as confirmed - prevents re-checking
      
      // Store in localStorage for persistence
      if (address) {
        localStorage.setItem(`usdc_approved_${address}`, 'true')
      }
      
      alert('✅ USDC Approved! You can now place orders.')
      
      console.log('🎉 Approval state locked - will not recheck automatically')
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
