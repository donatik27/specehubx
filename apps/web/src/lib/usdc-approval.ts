import { ethers } from 'ethers'
import { CONTRACTS, USDC_ABI } from './contracts'

/**
 * Check if user has approved USDC for CTF contract
 */
export async function checkUSDCAllowance(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<bigint> {
  const usdcContract = new ethers.Contract(
    CONTRACTS.USDC,
    USDC_ABI,
    provider
  )
  
  const allowance = await usdcContract.allowance(userAddress, CONTRACTS.CTF)
  return BigInt(allowance.toString())
}

/**
 * Approve USDC for CTF contract (infinite approval)
 */
export async function approveUSDC(
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const usdcContract = new ethers.Contract(
    CONTRACTS.USDC,
    USDC_ABI,
    signer
  )
  
  // Approve max amount (infinite approval)
  const maxApproval = ethers.constants.MaxUint256
  
  const tx = await usdcContract.approve(CONTRACTS.CTF, maxApproval)
  return tx
}

/**
 * Get USDC balance
 */
export async function getUSDCBalance(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<bigint> {
  const usdcContract = new ethers.Contract(
    CONTRACTS.USDC,
    USDC_ABI,
    provider
  )
  
  const balance = await usdcContract.balanceOf(userAddress)
  return BigInt(balance.toString())
}

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(amount: bigint): string {
  return (Number(amount) / 1e6).toFixed(2)
}

/**
 * Parse USDC amount to wei (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount) * 1e6))
}
