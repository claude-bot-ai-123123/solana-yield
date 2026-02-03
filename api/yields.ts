export const config = {
  runtime: 'edge',
};

// Protocols we actively support with full integration
const SUPPORTED_PROTOCOLS = ['kamino', 'drift', 'jito', 'marinade', 'orca', 'lulo'];

// Additional protocols to show (read-only yield data)
const EXTENDED_PROTOCOLS = ['raydium', 'sanctum', 'marginfi', 'solend', 'pump'];

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };

  const url = new URL(request.url);
  const extended = url.searchParams.get('extended') === 'true';
  const minApy = parseFloat(url.searchParams.get('minApy') || '0');
  const minTvl = parseFloat(url.searchParams.get('minTvl') || '100000');

  try {
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    const protocols = extended 
      ? [...SUPPORTED_PROTOCOLS, ...EXTENDED_PROTOCOLS]
      : SUPPORTED_PROTOCOLS;
    
    let solanaYields = data.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd >= minTvl && p.apy >= minApy)
      .filter((p: any) => protocols.some(
        proto => p.project.toLowerCase().includes(proto) && proto !== 'pump'
      ))
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, extended ? 50 : 20)
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: Math.round(p.apy * 100) / 100,
        tvl: Math.round(p.tvlUsd),
        risk: assessRisk(p),
        supported: SUPPORTED_PROTOCOLS.some(proto => p.project.toLowerCase().includes(proto)),
        pool: p.pool,
      }));

    // Add Pump.fun yields if extended mode
    if (extended || protocols.includes('pump')) {
      try {
        const baseUrl = new URL(request.url).origin;
        const pumpResponse = await fetch(`${baseUrl}/api/yields/pump`);
        const pumpData = await pumpResponse.json();
        
        if (pumpData.yields) {
          const pumpFormatted = pumpData.yields
            .filter((p: any) => p.apy >= minApy && p.tvl >= minTvl)
            .map((p: any) => ({
              protocol: 'pump.fun',
              asset: p.asset,
              apy: Math.round(p.apy * 100) / 100,
              tvl: Math.round(p.tvl),
              risk: 'high' as const,
              supported: false,
              pool: 'meme-trading',
            }));
          
          solanaYields = [...pumpFormatted, ...solanaYields].slice(0, extended ? 50 : 20);
        }
      } catch (err) {
        console.warn('Failed to fetch pump.fun yields:', err);
      }
    }

    return new Response(JSON.stringify({ 
      count: solanaYields.length,
      supported_protocols: SUPPORTED_PROTOCOLS,
      yields: solanaYields 
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch yields' }), { status: 500, headers });
  }
}

function assessRisk(pool: any): 'low' | 'medium' | 'high' {
  if (pool.stablecoin) return 'low';
  if (pool.ilRisk === 'yes') return 'high';
  if (pool.apy > 50) return 'high';
  if (pool.apy > 20) return 'medium';
  return 'medium';
}
