/**
 * Strategy Blinks - Shareable Solana Actions
 * 
 * Generate Dialect/Solana Actions compliant responses for strategies
 * Users can share strategies as clickable links, one-click execution
 * 
 * GET /api/blink?risk=medium&amount=100
 * Returns Solana Actions JSON that wallets/apps can render
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

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const headers = { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // GET returns the action metadata
  if (request.method === 'GET') {
    const risk = url.searchParams.get('risk') || 'medium';
    const amount = url.searchParams.get('amount') || '100';

    try {
      // Fetch current strategy
      const strategyRes = await fetch(`${BASE_URL}/api/strategy?risk=${risk}&amount=${amount}`);
      const strategy = await strategyRes.json();

      if (strategy.error) {
        const response: BlinkResponse = {
          icon: ICON_URL,
          title: 'SolanaYield Strategy',
          description: 'No opportunities match your criteria',
          label: 'Unavailable',
          disabled: true,
          error: { message: strategy.error }
        };
        return new Response(JSON.stringify(response), { headers });
      }

      // Build allocation summary
      const topAllocations = strategy.allocations.slice(0, 3);
      const allocationSummary = topAllocations
        .map((a: any) => `${a.allocation}% ${a.asset} on ${a.protocol} (${a.apy}%)`)
        .join('\n');

      const response: BlinkResponse = {
        icon: ICON_URL,
        title: `🌾 ${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk Strategy`,
        description: `Expected APY: ${strategy.strategy.expectedApy}%\n\n${allocationSummary}\n\nAI-optimized allocation across ${strategy.strategy.diversification} protocols.`,
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
              label: 'View Analysis',
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
        error: { message: 'Service temporarily unavailable' }
      };
      return new Response(JSON.stringify(response), { status: 500, headers });
    }
  }

  // POST would handle the actual transaction signing (future)
  if (request.method === 'POST') {
    // For now, return instructions - actual execution requires wallet integration
    const body = await request.json();
    
    return new Response(JSON.stringify({
      message: 'Strategy execution requires wallet connection. Visit the live demo to execute.',
      redirect: `${BASE_URL}/live`,
      // In production, this would return a transaction for signing:
      // transaction: base64EncodedTransaction
    }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
    status: 405, 
    headers 
  });
}
