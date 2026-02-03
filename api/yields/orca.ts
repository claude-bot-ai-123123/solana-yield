import { Connection } from '@solana/web3.js';
import { OrcaAdapter } from '../../src/adapters/orca';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };

  const url = new URL(request.url);
  const featured = url.searchParams.get('featured') === 'true';

  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const adapter = new OrcaAdapter(connection);
    
    const yields = featured 
      ? await adapter.getFeaturedPools()
      : await adapter.getYields();

    return new Response(JSON.stringify({ 
      protocol: 'orca',
      description: 'Orca - Leading AMM with concentrated liquidity (Whirlpools)',
      features: [
        'Concentrated liquidity for capital efficiency',
        'Low slippage on major pairs',
        'Deep liquidity pools ($30M+ in top pools)',
        'Support for both standard and exotic pairs'
      ],
      count: yields.length,
      totalTvl: yields.reduce((sum, y) => sum + y.tvl, 0),
      yields 
    }), { headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Orca yields' }), 
      { status: 500, headers }
    );
  }
}
