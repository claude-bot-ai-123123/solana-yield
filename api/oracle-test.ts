import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Simple test: fetch SOL price from Pyth Hermes
    const solFeedId = 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d';
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${solFeedId}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.parsed && data.parsed[0]) {
      const p = data.parsed[0];
      const price = parseFloat(p.price.price) * Math.pow(10, p.price.expo);
      return res.status(200).json({
        symbol: 'SOL/USD',
        price: price.toFixed(2),
        timestamp: p.price.publish_time,
        source: 'Pyth Hermes',
      });
    }
    
    return res.status(500).json({ error: 'No price data', raw: data });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
