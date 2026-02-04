import { NextResponse } from 'next/server';
import { createPythOracle, PYTH_PRICE_FEEDS } from '@/lib/pyth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    const oracle = createPythOracle();

    // Single symbol query
    if (symbol && symbol in PYTH_PRICE_FEEDS) {
      const price = await oracle.getPrice(symbol as keyof typeof PYTH_PRICE_FEEDS);
      if (!price) {
        return NextResponse.json({ error: 'Price not available' }, { status: 404 });
      }
      return NextResponse.json(price);
    }

    // All prices
    const prices = await oracle.getAllPrices();
    
    return NextResponse.json({
      prices,
      timestamp: Date.now(),
      source: 'Pyth Network',
    });
  } catch (error) {
    console.error('Oracle API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch oracle data' },
      { status: 500 }
    );
  }
}
