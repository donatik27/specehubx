import { NextResponse } from 'next/server';
import { STATIC_MAPPED_TRADERS } from '@/lib/static-traders';

export const dynamic = 'force-static';

export async function GET() {
  // Return static pre-mapped traders
  return NextResponse.json(STATIC_MAPPED_TRADERS);
}
