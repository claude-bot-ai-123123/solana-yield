export const config = {
  runtime: 'edge',
};

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };

  const url = new URL(request.url);
  
  // Support both GET query params and POST JSON body
  let risk: 'low' | 'medium' | 'high' = 'medium';
  let amount = 1000;
  
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      risk = body.riskTolerance || body.risk || 'medium';
      amount = parseFloat(body.amount) || 1000;
    } catch {
      // Fall back to query params
    }
  }
  
  // Query params override (or used for GET)
  risk = (url.searchParams.get('risk') || url.searchParams.get('riskTolerance') || risk) as 'low' | 'medium' | 'high';
  amount = parseFloat(url.searchParams.get('amount') || '') || amount;

  try {
    // Fetch yields
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    const yields: YieldOpp[] = data.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy > 0)
      .filter((p: any) => ['kamino', 'drift', 'jito', 'marinade'].some(
        proto => p.project.toLowerCase().includes(proto)
      ))
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: p.apy,
        tvl: p.tvlUsd,
        risk: p.stablecoin ? 'low' : p.apy > 20 ? 'high' : 'medium',
      }));

    // Filter by risk tolerance
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const eligible = yields.filter(y => riskLevels[y.risk] <= riskLevels[risk]);

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No opportunities match your risk tolerance' 
      }), { status: 400, headers });
    }

    // Build allocation strategy
    const topOpps = eligible.slice(0, 5);
    const totalWeight = topOpps.reduce((sum, o) => sum + o.apy, 0);
    
    const allocations = topOpps.map(opp => ({
      protocol: opp.protocol,
      asset: opp.asset,
      apy: Math.round(opp.apy * 100) / 100,
      risk: opp.risk,
      allocation: Math.round((opp.apy / totalWeight) * 100),
      amount: Math.round((opp.apy / totalWeight) * amount * 100) / 100,
    }));

    const weightedApy = allocations.reduce((sum, a) => sum + (a.apy * a.allocation / 100), 0);

    return new Response(JSON.stringify({
      strategy: {
        riskTolerance: risk,
        totalAmount: amount,
        expectedApy: Math.round(weightedApy * 100) / 100,
        diversification: allocations.length,
      },
      allocations,
      disclaimer: 'This is not financial advice. DeFi carries risks including smart contract bugs and impermanent loss.',
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to generate strategy' }), { status: 500, headers });
  }
}
