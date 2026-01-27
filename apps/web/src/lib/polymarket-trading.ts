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
    const client = createPolymarketClient(signer)

    // Convert side to SDK enum
    const side = params.side === 'BUY' ? Side.BUY : Side.SELL

    // Create and post order
    const response = await client.createAndPostOrder(
      {
        tokenID: params.tokenID,
        price: params.price,
        side,
        size: params.size,
      },
      {
        tickSize: params.tickSize ? (params.tickSize as any) : undefined,
        negRisk: params.negRisk || false,
      },
      OrderType.GTC // Good-Til-Cancelled
    )

    return {
      success: true,
      orderID: response.orderID,
      status: response.status,
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
