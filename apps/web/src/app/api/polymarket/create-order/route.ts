import { NextRequest, NextResponse } from 'next/server'
import nacl from 'tweetnacl'
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util'

export const dynamic = 'force-dynamic'

/**
 * Polymarket CLOB Order Creation (Server-Side)
 * 
 * This endpoint handles order creation with API credentials on the backend.
 * Requires environment variables:
 * - POLYMARKET_API_KEY_ID: Your public API key UUID
 * - POLYMARKET_PRIVATE_KEY: Your Ed25519 private key (base64)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tokenID, price, side, size, userAddress } = body

    // Validate required fields
    if (!tokenID || !price || !side || !size || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check for API credentials
    const apiKey = process.env.POLYMARKET_API_KEY
    const secret = process.env.POLYMARKET_SECRET
    const passphrase = process.env.POLYMARKET_PASSPHRASE

    if (!apiKey || !secret || !passphrase) {
      return NextResponse.json(
        {
          error: 'API credentials not configured',
          message: 'Set POLYMARKET_API_KEY, POLYMARKET_SECRET, and POLYMARKET_PASSPHRASE in Vercel environment variables',
          docs: 'https://docs.polymarket.com/developers/CLOB/authentication',
        },
        { status: 503 }
      )
    }

    // Prepare order payload
    const timestamp = Date.now()
    const orderPayload = {
      tokenID,
      price: price.toString(),
      side: side.toUpperCase(),
      size: size.toString(),
      feeRateBps: '0',
      nonce: timestamp,
      maker: userAddress,
      expiration: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    }

    // Create signature for authentication
    const method = 'POST'
    const path = '/order'
    const message = `${timestamp}${method}${path}${JSON.stringify(orderPayload)}`
    const messageBytes = decodeUTF8(message)
    
    // Decode secret (base64) to use for signing
    const secretBytes = Buffer.from(secret, 'base64')
    if (secretBytes.length !== 32) {
      return NextResponse.json(
        { error: 'Invalid secret format' },
        { status: 500 }
      )
    }
    
    const signature = nacl.sign.detached(messageBytes, secretBytes)
    const signatureBase64 = encodeBase64(signature)

    // Send order to Polymarket CLOB
    const response = await fetch('https://clob.polymarket.com/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PM-Access-Key': apiKey,
        'X-PM-Timestamp': timestamp.toString(),
        'X-PM-Signature': signatureBase64,
        'X-PM-Passphrase': passphrase,
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Polymarket API error:', response.status, errorData)
      
      return NextResponse.json(
        {
          error: 'Order creation failed',
          details: errorData,
          status: response.status,
        },
        { status: response.status }
      )
    }

    const orderData = await response.json()

    return NextResponse.json({
      success: true,
      orderID: orderData.orderID || orderData.id,
      status: orderData.status,
      message: 'Order created successfully',
    })

  } catch (error: any) {
    console.error('Order creation error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
