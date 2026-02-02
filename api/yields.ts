const LLAMA_API = 'https://yields.llama.fi/pools';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const response = await fetch(LLAMA_API);
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

    res.json({ yields: solanaYields });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch yields' });
  }
}
