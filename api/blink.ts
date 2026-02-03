/**
 * Strategy Blinks - Shareable Solana Actions
 * GET /api/blink?risk=medium&amount=100
 */

export const config = {
  runtime: 'edge',
};

const ICON_URL = 'https://solana-yield.vercel.app/icon.svg';
const BASE_URL = 'https://solana-yield.vercel.app';

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const headers = { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const risk = url.searchParams.get('risk') || 'medium';
  const amount = parseFloat(url.searchParams.get('amount') || '100');

  try {
    // Fetch yields directly from DeFi Llama (no self-reference)
    const llamaRes = await fetch('https://yields.llama.fi/pools');
    const llamaData = await llamaRes.json();
    
    if (!llamaData?.data) {
      return new Response(JSON.stringify({
        icon: ICON_URL,
        title: 'SolanaYield Strategy',
        description: 'Unable to fetch yield data',
        label: 'Error',
        disabled: true,
      }), { headers });
    }

    // Process yields
    const yields: YieldOpp[] = llamaData.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy > 0)
      .filter((p: any) => ['kamino', 'drift', 'jito', 'marinade'].some(
        (proto: string) => p.project?.toLowerCase().includes(proto)
      ))
      .slice(0, 50)
      .map((p: any) => ({
        protocol: p.project || 'Unknown',
        asset: p.symbol || 'Unknown',
        apy: p.apy || 0,
        tvl: p.tvlUsd || 0,
        risk: (p.stablecoin ? 'low' : p.apy > 20 ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      }));

    // Filter by risk tolerance
    const riskLevels: Record<string, number> = { low: 1, medium: 2, high: 3 };
    const maxRisk = riskLevels[risk] || 2;
    const eligible = yields.filter(y => riskLevels[y.risk] <= maxRisk);

    if (eligible.length === 0) {
      return new Response(JSON.stringify({
        icon: ICON_URL,
        title: 'SolanaYield Strategy',
        description: `No opportunities match ${risk} risk tolerance`,
        label: 'Unavailable',
        disabled: true,
      }), { headers });
    }

    // Build allocation
    const topOpps = eligible.sort((a, b) => b.apy - a.apy).slice(0, 5);
    const totalWeight = topOpps.reduce((sum, o) => sum + o.apy, 0);
    
    const allocations = topOpps.map(opp => ({
      protocol: opp.protocol,
      asset: opp.asset,
      apy: Math.round(opp.apy * 100) / 100,
      allocation: Math.round((opp.apy / totalWeight) * 100),
    }));

    const weightedApy = allocations.reduce((sum, a) => sum + (a.apy * a.allocation / 100), 0);

    // Format for blink
    const topThree = allocations.slice(0, 3);
    const summary = topThree
      .map(a => `• ${a.allocation}% ${a.asset} @ ${a.apy}%`)
      .join('\n');

    return new Response(JSON.stringify({
      icon: ICON_URL,
      title: `🌾 ${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk Strategy`,
      description: `Expected APY: ${Math.round(weightedApy * 100) / 100}%\n\n${summary}\n\n${allocations.length} protocols, AI-optimized`,
      label: `Deploy $${amount}`,
      links: {
        actions: [
          {
            label: `Deploy $${amount} (${Math.round(weightedApy)}% APY)`,
            href: `${BASE_URL}/live`,
          },
          {
            label: '📊 View Live Analysis',
            href: `${BASE_URL}/live`,
          }
        ]
      }
    }), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({
      icon: ICON_URL,
      title: 'SolanaYield Strategy',
      description: 'Error generating blink',
      label: 'Error',
      disabled: true,
      error: { message: err?.message || String(err) }
    }), { status: 500, headers });
  }
}
