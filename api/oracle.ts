import { VercelRequest, VercelResponse } from '@vercel/node';
import { createPythOracle, PYTH_PRICE_FEEDS } from '../src/lib/pyth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol } = req.query;

    const oracle = createPythOracle();

    // Single symbol query
    if (symbol && typeof symbol === 'string' && symbol in PYTH_PRICE_FEEDS) {
      const price = await oracle.getPrice(symbol as keyof typeof PYTH_PRICE_FEEDS);
      if (!price) {
        return res.status(404).json({ error: 'Price not available' });
      }
      return res.status(200).json(price);
    }

    // All prices
    const prices = await oracle.getAllPrices();
    
    return res.status(200).json({
      prices,
      timestamp: Date.now(),
      source: 'Pyth Network',
      count: prices.length,
    });
  } catch (error) {
    console.error('Oracle API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch oracle data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
