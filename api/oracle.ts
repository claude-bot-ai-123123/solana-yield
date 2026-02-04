import { VercelRequest, VercelResponse } from '@vercel/node';

// Pyth price feed IDs (Hermes format)
const PYTH_FEEDS: Record<string, string> = {
  'SOL/USD': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/USD': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'mSOL/USD': 'c2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4',
  'JTO/USD': 'b43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2',
  'JUP/USD': '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'BONK/USD': '72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'RAY/USD': '91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
};

interface PythPrice {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol } = req.query;
    const feedIds = Object.values(PYTH_FEEDS);
    
    // Fetch from Pyth Hermes API
    const url = `https://hermes.pyth.network/v2/updates/price/latest?${feedIds.map(id => `ids[]=${id}`).join('&')}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status}`);
    }
    
    const data = await response.json();
    const prices: PythPrice[] = data.parsed || [];
    
    // Map feed IDs back to symbols
    const feedToSymbol = Object.entries(PYTH_FEEDS).reduce((acc, [sym, id]) => {
      acc[id] = sym;
      return acc;
    }, {} as Record<string, string>);
    
    const formattedPrices = prices.map(p => {
      const symbol = feedToSymbol[p.id] || p.id;
      const price = parseFloat(p.price.price) * Math.pow(10, p.price.expo);
      const confidence = parseFloat(p.price.conf) * Math.pow(10, p.price.expo);
      
      return {
        symbol,
        price: price,
        confidence: confidence,
        publishTime: p.price.publish_time,
        feedId: p.id,
      };
    });

    // Single symbol query
    if (symbol && typeof symbol === 'string') {
      const found = formattedPrices.find(p => p.symbol === symbol);
      if (!found) {
        return res.status(404).json({ error: `Price not found for ${symbol}` });
      }
      return res.status(200).json(found);
    }

    return res.status(200).json({
      prices: formattedPrices,
      timestamp: Date.now(),
      source: 'Pyth Network (Hermes)',
      count: formattedPrices.length,
    });
  } catch (error) {
    console.error('Oracle API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch oracle data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
