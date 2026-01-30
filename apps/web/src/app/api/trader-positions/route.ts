import { NextRequest, NextResponse } from 'next/server'

// Proxy endpoint for Polymarket CLOB positions API
// Avoids CORS issues when fetching from client-side
// Force rebuild

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 Fetching positions for trader: ${address}`)

    // Fetch from Polymarket Data API (not CLOB!)
    const dataApiUrl = `https://data-api.polymarket.com/positions?user=${address}`
    console.log(`📡 Data API URL: ${dataApiUrl}`)
    
    const response = await fetch(dataApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      next: {
        revalidate: 30 // Cache for 30 seconds
      }
    })

    console.log(`📡 CLOB Response status: ${response.status}`)

    if (!response.ok) {
      console.error(`❌ CLOB API error: ${response.status}`)
      const errorText = await response.text()
      console.error(`❌ Error body: ${errorText}`)
      return NextResponse.json(
        { error: 'Failed to fetch positions from Polymarket', positions: [] },
        { status: response.status }
      )
    }

    const positions = await response.json()
    console.log(`📊 Found ${positions.length} positions`)
    if (positions.length > 0) {
      console.log(`📊 Sample position:`, positions[0])
    }

    return NextResponse.json({
      success: true,
      count: positions.length,
      positions
    })

  } catch (error) {
    console.error('❌ Error in trader-positions API:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        positions: []
      },
      { status: 500 }
    )
  }
}
