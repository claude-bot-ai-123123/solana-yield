export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    const solanaYields = data.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy > 0)
      .filter((p: any) => ['kamino', 'drift', 'jito', 'marinade'].some(
        proto => p.project.toLowerCase().includes(proto)
      ))
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 20)
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: Math.round(p.apy * 100) / 100,
        tvl: Math.round(p.tvlUsd),
        risk: p.stablecoin ? 'low' : p.apy > 20 ? 'high' : 'medium',
      }));

    return new Response(JSON.stringify({ yields: solanaYields }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch yields' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
