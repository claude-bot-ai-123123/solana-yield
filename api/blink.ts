/**
 * Strategy Blinks - Shareable Solana Actions
 * 
 * Generate Dialect/Solana Actions compliant responses for strategies
 * Users can share strategies as clickable links
 * 
 * GET /api/blink?risk=medium&amount=100
 */

export const config = {
  runtime: 'edge',
};

const ICON_URL = 'https://solana-yield.vercel.app/icon.svg';
const BASE_URL = 'https://solana-yield.vercel.app';

interface BlinkAction {
  label: string;
  href: string;
  parameters?: Array<{
    name: string;
    label: string;
    required?: boolean;
  }>;
}

interface BlinkResponse {
  icon: string;
  title: string;
  description: string;
  label: string;
  links?: {
    actions: BlinkAction[];
  };
  disabled?: boolean;
  error?: { message: string };
}

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

async function fetchStrategy(risk: string, amount: number) {
  // Fetch yields directly from DeFi Llama
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

  const riskLevels: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const eligible = yields.filter(y => riskLevels[y.risk] <= riskLevels[risk]);

  if (eligible.length === 0) {
    return null;
  }

  const topOpps = eligible.sort((a, b) => b.apy - a.apy).slice(0, 5);
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

  return {
    strategy: {
      riskTolerance: risk,
      totalAmount: amount,
      expectedApy: Math.round(weightedApy * 100) / 100,
      diversification: allocations.length,
    },
    allocations,
  };
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

  if (request.method === 'GET') {
    const risk = url.searchParams.get('risk') || 'medium';
    const amount = parseFloat(url.searchParams.get('amount') || '100');

    try {
      let strategy;
      try {
        strategy = await fetchStrategy(risk, amount);
      } catch (fetchError) {
        const response: BlinkResponse = {
          icon: ICON_URL,
          title: 'SolanaYield Strategy',
          description: 'Error fetching strategy data',
          label: 'Error',
          disabled: true,
          error: { message: `Fetch error: ${String(fetchError)}` }
        };
        return new Response(JSON.stringify(response), { status: 500, headers });
      }

      if (!strategy) {
        const response: BlinkResponse = {
          icon: ICON_URL,
          title: 'SolanaYield Strategy',
          description: 'No opportunities match your criteria',
          label: 'Unavailable',
          disabled: true,
          error: { message: 'No opportunities found' }
        };
        return new Response(JSON.stringify(response), { headers });
      }

      const topAllocations = strategy.allocations.slice(0, 3);
      const allocationSummary = topAllocations
        .map((a: any) => `• ${a.allocation}% ${a.asset} @ ${a.apy}%`)
        .join('\n');

      const response: BlinkResponse = {
        icon: ICON_URL,
        title: `🌾 ${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk Strategy`,
        description: `Expected APY: ${strategy.strategy.expectedApy}%\n\n${allocationSummary}\n\n${strategy.strategy.diversification} protocols, AI-optimized`,
        label: `Deploy $${amount}`,
        links: {
          actions: [
            {
              label: `Deploy $${amount} (${strategy.strategy.expectedApy}% APY)`,
              href: `${BASE_URL}/api/blink/execute?risk=${risk}&amount=${amount}`,
            },
            {
              label: 'Custom Amount',
              href: `${BASE_URL}/api/blink/execute?risk=${risk}&amount={amount}`,
              parameters: [
                {
                  name: 'amount',
                  label: 'Amount (USDC)',
                  required: true,
                }
              ]
            },
            {
              label: '📊 View Live Analysis',
              href: `${BASE_URL}/live`,
            }
          ]
        }
      };

      return new Response(JSON.stringify(response), { headers });

    } catch (err) {
      const response: BlinkResponse = {
        icon: ICON_URL,
        title: 'SolanaYield Strategy',
        description: 'Failed to load strategy',
        label: 'Error',
        disabled: true,
        error: { message: String(err) }
      };
      return new Response(JSON.stringify(response), { status: 500, headers });
    }
  }

  if (request.method === 'POST') {
    return new Response(JSON.stringify({
      message: 'Strategy execution requires wallet connection.',
      redirect: `${BASE_URL}/live`,
    }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
    status: 405, 
    headers 
  });
}
