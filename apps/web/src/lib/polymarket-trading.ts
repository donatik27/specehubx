/**
 * Polymarket Trading Client
 * Based on official documentation: https://docs.polymarket.com/developers/CLOB/quickstart
 */

import { ClobClient, OrderType, Side } from '@polymarket/clob-client'
import { ethers } from 'ethers'

const CLOB_URL = 'https://clob.polymarket.com'
const CHAIN_ID = 137 // Polygon

export interface CreateOrderParams {
  tokenID: string
  price: number // 0.01 - 0.99
  side: 'BUY' | 'SELL'
  size: number // Amount in USDC
  tickSize?: string
  negRisk?: boolean
}

export interface OrderResponse {
  success: boolean
  orderID?: string
  status?: string
  error?: string
}

/**
 * Create Polymarket CLOB Client with user's wallet
 */
export function createPolymarketClient(signer: any) {
  return new ClobClient(
    CLOB_URL,
    CHAIN_ID,
    signer as any
  )
}

/**
 * Place order on Polymarket
 * 
 * This will:
 * 1. Create order with user's parameters
 * 2. Sign order with user's wallet (MetaMask popup!)
 * 3. Submit to Polymarket CLOB API
 * 4. Return real order ID from Polymarket
 */
export async function placePolymarketOrder(
  signer: any,
  params: CreateOrderParams
): Promise<OrderResponse> {
  try {
    // Get user address for order
    const userAddress = await signer.getAddress()

    // Call backend API for server-side order creation
    // Backend handles API credentials and signing
    const response = await fetch('/api/polymarket/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenID: params.tokenID,
        price: params.price,
        side: params.side,
        size: params.size,
        userAddress,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 503 && data.error?.includes('not configured')) {
        return {
          success: false,
          error: 'API credentials not set up. Please add POLYMARKET_API_KEY_ID and POLYMARKET_PRIVATE_KEY to Vercel environment variables.',
        }
      }

      return {
        success: false,
        error: data.error || data.message || 'Order creation failed',
      }
    }

    return {
      success: true,
      orderID: data.orderID,
      status: data.status,
    }
  } catch (error: any) {
    console.error('Polymarket order error:', error)
    
    return {
      success: false,
      error: error.message || 'Order placement failed',
    }
  }
}

/**
 * Get user's active orders
 * TODO: Implement when needed - check correct ClobClient method name
 */
// export async function getActiveOrders(signer: any) {
//   try {
//     const client = createPolymarketClient(signer)
//     const address = await signer.getAddress()
//     return await client.getOrders({ maker: address })
//   } catch (error) {
//     console.error('Error fetching orders:', error)
//     return []
//   }
// }

/**
 * Cancel order
 * TODO: Implement when needed
 */
// export async function cancelOrder(signer: any, orderID: string) {
//   try {
//     const client = createPolymarketClient(signer)
//     return await client.cancelOrder({ orderID })
//   } catch (error: any) {
//     console.error('Error canceling order:', error)
//     throw new Error(error.message || 'Cancel failed')
//   }
// }
