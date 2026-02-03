import { Connection } from '@solana/web3.js';
import { PumpAdapter } from '../../src/adapters/pump';

export const config = {
  runtime: 'nodejs',
};

export default async function handler() {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };

  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const adapter = new PumpAdapter(connection);
    const yields = await adapter.getYields();

    return new Response(JSON.stringify({ 
      protocol: 'pump.fun',
      description: 'Trading fee yields from popular meme token bonding curves',
      count: yields.length,
      yields 
    }), { headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Pump.fun yields' }), 
      { status: 500, headers }
    );
  }
}
