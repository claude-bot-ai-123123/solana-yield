/**
 * Solana Actions API - Main Entry Point
 * Implements the full Solana Actions spec for DeFi yield strategies
 * 
 * Edge-compatible: Uses fetch APIs only, no Node.js modules
 * 
 * Endpoints:
 * - GET /api/actions?type=deposit&protocol=kamino
 * - POST /api/actions (with transaction signing)
 */

export const config = {
  runtime: 'edge',
};

const ICON_URL = 'https://solana-yield.vercel.app/icon.svg';
const BASE_URL = 'https://solana-yield.vercel.app';
const LAMPORTS_PER_SOL = 1_000_000_000;

// Protocol metadata
const PROTOCOLS: Record<string, {
  name: string;
  description: string;
  icon: string;
  color: string;
  apy: { min: number; max: number };
  minDeposit: number;
  actions: string[];
  blinkUrl?: string;
}> = {
  kamino: {
    name: 'Kamino Finance',
    description: 'Automated liquidity management & lending',
    icon: '🏛️',
    color: '#14F195',
    apy: { min: 5, max: 25 },
    minDeposit: 0.1,
    actions: ['deposit', 'withdraw', 'claim'],
    blinkUrl: 'https://app.kamino.finance/api/blink',
  },
  jito: {
    name: 'Jito',
    description: 'MEV-powered liquid staking',
    icon: '⚡',
    color: '#00D18C',
    apy: { min: 7, max: 9 },
    minDeposit: 0.01,
    actions: ['stake', 'unstake'],
    blinkUrl: 'https://jito.network/api/blink/stake',
  },
  marinade: {
    name: 'Marinade Finance',
    description: 'Liquid staking protocol',
    icon: '🥩',
    color: '#4BA3C3',
    apy: { min: 6, max: 8 },
    minDeposit: 0.01,
    actions: ['stake', 'unstake', 'delayed-unstake'],
    blinkUrl: 'https://marinade.finance/api/blink/stake',
  },
  drift: {
    name: 'Drift Protocol',
    description: 'Perpetuals & spot trading',
    icon: '📈',
    color: '#E84142',
    apy: { min: 3, max: 40 },
    minDeposit: 1,
    actions: ['deposit', 'withdraw', 'trade'],
    blinkUrl: 'https://app.drift.trade/api/blinks/deposit',
  },
  jupiter: {
    name: 'Jupiter',
    description: 'DEX aggregator',
    icon: '🪐',
    color: '#4ADE80',
    apy: { min: 0, max: 0 },
    minDeposit: 0.001,
    actions: ['swap'],
    blinkUrl: 'https://worker.jup.ag/blinks/swap',
  },
};

// CORS headers for Solana Actions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
  'Access-Control-Expose-Headers': 'X-Action-Version, X-Blockchain-Ids',
  'X-Action-Version': '2.1.3',
  'X-Blockchain-Ids': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
};

interface ActionResponse {
  type: 'action';
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  error?: { message: string };
  links?: {
    actions: Array<{
      label: string;
      href: string;
      parameters?: Array<{
        name: string;
        label: string;
        required?: boolean;
        type?: string;
      }>;
    }>;
  };
}

interface PostResponse {
  type: 'transaction';
  transaction: string;
  message?: string;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json', ...corsHeaders };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const actionType = url.searchParams.get('type') || 'strategy';
  const protocol = url.searchParams.get('protocol');
  const risk = url.searchParams.get('risk') || 'medium';

  // GET: Return action metadata
  if (request.method === 'GET') {
    try {
      // Strategy action (AI-optimized allocation)
      if (actionType === 'strategy') {
        return new Response(JSON.stringify(await getStrategyAction(risk)), { headers });
      }

      // Protocol-specific action
      if (protocol && PROTOCOLS[protocol]) {
        return new Response(JSON.stringify(await getProtocolAction(protocol, actionType)), { headers });
      }

      // List all available actions
      return new Response(JSON.stringify(await getActionsDirectory()), { headers });
    } catch (err: any) {
      return new Response(JSON.stringify({
        type: 'action',
        icon: ICON_URL,
        title: 'Error',
        description: err.message || 'Failed to generate action',
        label: 'Error',
        disabled: true,
      }), { status: 500, headers });
    }
  }

  // POST: Build and return transaction
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const account = body.account;

      if (!account) {
        return new Response(JSON.stringify({
          error: { message: 'Missing account' }
        }), { status: 400, headers });
      }

      const amount = parseFloat(url.searchParams.get('amount') || body.amount || '0');
      
      // Build transaction based on action type
      let result: PostResponse;

      if (actionType === 'strategy') {
        result = await buildStrategyTransaction(account, amount, risk);
      } else if (protocol && PROTOCOLS[protocol]) {
        result = await buildProtocolTransaction(protocol, actionType, account, amount, body);
      } else {
        return new Response(JSON.stringify({
          error: { message: 'Unknown action type' }
        }), { status: 400, headers });
      }

      return new Response(JSON.stringify(result), { headers });
    } catch (err: any) {
      return new Response(JSON.stringify({
        error: { message: err.message || 'Transaction build failed' }
      }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), { 
    status: 405, 
    headers 
  });
}

/**
 * GET: AI-optimized strategy action
 */
async function getStrategyAction(risk: string): Promise<ActionResponse> {
  // Fetch live yields
  const yields = await fetchYields();
  
  const riskLabels: Record<string, string> = {
    low: '🟢 Conservative',
    medium: '🟡 Balanced',
    high: '🔴 Aggressive',
  };

  const topYields = yields
    .filter(y => {
      if (risk === 'low') return y.apy < 15 && y.tvl > 10_000_000;
      if (risk === 'high') return y.apy > 10;
      return y.tvl > 1_000_000;
    })
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 5);

  const avgApy = topYields.length > 0 
    ? topYields.reduce((s, y) => s + y.apy, 0) / topYields.length 
    : 8;
    
  const summary = topYields.slice(0, 3).map(y => 
    `${y.protocol}: ${y.asset} @ ${y.apy.toFixed(1)}%`
  ).join('\n');

  return {
    type: 'action',
    icon: ICON_URL,
    title: `SolanaYield ${riskLabels[risk] || 'Balanced'} Strategy`,
    description: `Expected APY: ${avgApy.toFixed(1)}%\n\nTop opportunities:\n${summary || 'Loading...'}`,
    label: 'Deploy Capital',
    links: {
      actions: [
        {
          label: 'Deploy SOL',
          href: `${BASE_URL}/api/actions?type=strategy&risk=${risk}&amount={amount}`,
          parameters: [
            {
              name: 'amount',
              label: 'Amount (SOL)',
              required: true,
              type: 'number',
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
}

/**
 * GET: Protocol-specific action
 */
async function getProtocolAction(protocol: string, actionType: string): Promise<ActionResponse> {
  const p = PROTOCOLS[protocol];
  
  const actionLabels: Record<string, string> = {
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    stake: 'Stake',
    unstake: 'Unstake',
    swap: 'Swap',
    claim: 'Claim Rewards',
  };

  if (!p.actions.includes(actionType)) {
    return {
      type: 'action',
      icon: ICON_URL,
      title: p.name,
      description: `${actionType} not supported for ${p.name}`,
      label: 'Not Available',
      disabled: true,
    };
  }

  const apyText = p.apy.max > 0 ? `${p.apy.min}-${p.apy.max}% APY` : '';

  return {
    type: 'action',
    icon: ICON_URL,
    title: `${p.icon} ${p.name}`,
    description: `${p.description}\n${apyText}`,
    label: actionLabels[actionType] || actionType,
    links: {
      actions: [
        {
          label: `${actionLabels[actionType]} SOL`,
          href: `${BASE_URL}/api/actions?type=${actionType}&protocol=${protocol}&amount={amount}`,
          parameters: [
            {
              name: 'amount',
              label: actionType === 'withdraw' ? 'Amount to withdraw' : 'Amount (SOL)',
              required: true,
              type: 'number',
            }
          ]
        }
      ]
    }
  };
}

/**
 * GET: Actions directory
 */
async function getActionsDirectory(): Promise<ActionResponse> {
  const protocols = Object.entries(PROTOCOLS).map(([key, p]) => 
    `${p.icon} ${p.name} - ${p.actions.join(', ')}`
  ).join('\n');

  return {
    type: 'action',
    icon: ICON_URL,
    title: 'SolanaYield Actions',
    description: `AI-powered DeFi yield optimization\n\nSupported protocols:\n${protocols}`,
    label: 'Choose Action',
    links: {
      actions: [
        {
          label: '🟢 Low Risk Strategy',
          href: `${BASE_URL}/api/actions?type=strategy&risk=low`,
        },
        {
          label: '🟡 Balanced Strategy',
          href: `${BASE_URL}/api/actions?type=strategy&risk=medium`,
        },
        {
          label: '🔴 High Yield Strategy',
          href: `${BASE_URL}/api/actions?type=strategy&risk=high`,
        },
        {
          label: '⚡ Jito Stake',
          href: `${BASE_URL}/api/actions?type=stake&protocol=jito`,
        },
        {
          label: '🥩 Marinade Stake',
          href: `${BASE_URL}/api/actions?type=stake&protocol=marinade`,
        },
        {
          label: '🏛️ Kamino Deposit',
          href: `${BASE_URL}/api/actions?type=deposit&protocol=kamino`,
        },
      ]
    }
  };
}

/**
 * POST: Build strategy transaction
 * Routes to the best yield opportunity based on risk tolerance
 */
async function buildStrategyTransaction(
  account: string, 
  amount: number, 
  risk: string
): Promise<PostResponse> {
  const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

  // Fetch best yield opportunity
  const yields = await fetchYields();
  const topYield = yields
    .filter(y => {
      if (risk === 'low') return y.apy < 15 && y.tvl > 10_000_000;
      if (risk === 'high') return y.apy > 10;
      return y.tvl > 1_000_000;
    })
    .sort((a, b) => b.apy - a.apy)[0];

  if (!topYield) {
    throw new Error('No suitable yield opportunities found');
  }

  const protocol = topYield.protocol.toLowerCase();

  // Route to appropriate protocol's blink API
  if (protocol.includes('jito')) {
    return await fetchExternalBlinkTransaction('jito', 'stake', account, lamports, topYield.apy);
  }

  if (protocol.includes('marinade')) {
    return await fetchExternalBlinkTransaction('marinade', 'stake', account, lamports, topYield.apy);
  }

  if (protocol.includes('drift')) {
    return await fetchExternalBlinkTransaction('drift', 'deposit', account, lamports, topYield.apy);
  }

  // Default: Use Jupiter swap to convert to the best asset
  return await fetchJupiterSwapTransaction(account, lamports, topYield);
}

/**
 * POST: Build protocol-specific transaction
 */
async function buildProtocolTransaction(
  protocol: string,
  actionType: string,
  account: string,
  amount: number,
  body: any
): Promise<PostResponse> {
  const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
  const p = PROTOCOLS[protocol];

  // Use external protocol blink APIs where available
  if (p.blinkUrl) {
    return await fetchExternalBlinkTransaction(protocol, actionType, account, lamports);
  }

  // Jupiter swap handling
  if (protocol === 'jupiter' && actionType === 'swap') {
    const outputMint = body.outputMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    return await fetchJupiterDirectSwap(account, lamports, outputMint);
  }

  throw new Error(`${actionType} not implemented for ${protocol}`);
}

/**
 * Fetch transaction from external protocol blink API
 */
async function fetchExternalBlinkTransaction(
  protocol: string,
  actionType: string,
  account: string,
  lamports: number,
  apy?: number
): Promise<PostResponse> {
  const p = PROTOCOLS[protocol];
  const amount = lamports / LAMPORTS_PER_SOL;
  
  // Try the protocol's native blink API
  if (p.blinkUrl) {
    try {
      const res = await fetch(p.blinkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          amount: amount.toString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transaction) {
          return {
            type: 'transaction',
            transaction: data.transaction,
            message: `${actionType === 'stake' ? 'Staking' : 'Depositing'} ${amount} SOL in ${p.name}${apy ? ` for ~${apy.toFixed(1)}% APY` : ''}`,
          };
        }
      }
    } catch (err) {
      console.error(`Failed to fetch from ${protocol} blink API:`, err);
    }
  }

  // Fallback: Use known working dial.to endpoints
  const dialEndpoints: Record<string, string> = {
    jito: `https://jito.dial.to/api/stake?amount=${amount}`,
    marinade: `https://marinade.dial.to/api/stake?amount=${amount}`,
    kamino: `https://kamino.dial.to/api/lend/jlp/deposit?amount=${amount}`,
  };

  if (dialEndpoints[protocol]) {
    try {
      const res = await fetch(dialEndpoints[protocol], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.transaction) {
          return {
            type: 'transaction',
            transaction: data.transaction,
            message: `${actionType === 'stake' ? 'Staking' : 'Depositing'} ${amount} SOL in ${p.name}`,
          };
        }
      }
    } catch (err) {
      console.error(`Failed to fetch from dial.to ${protocol}:`, err);
    }
  }

  // If all external APIs fail, return an error with instructions
  throw new Error(`${p.name} transaction API temporarily unavailable. Please try directly at ${p.name.toLowerCase().replace(' ', '')}.com`);
}

/**
 * Fetch Jupiter swap transaction for strategy
 */
async function fetchJupiterSwapTransaction(
  account: string,
  lamports: number,
  targetYield: { protocol: string; asset: string; apy: number }
): Promise<PostResponse> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  // Map common assets to mint addresses
  const assetMints: Record<string, string> = {
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'SOL': SOL_MINT,
    'mSOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    'jitoSOL': 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    'bSOL': 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    'stSOL': '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  };

  // Try to find the output mint for the target asset
  const assetName = targetYield.asset.split('-')[0].toUpperCase();
  const outputMint = assetMints[assetName] || assetMints['USDC'];

  // If target is already SOL-based liquid staking, route to that protocol
  if (assetName === 'JITOSOL' || targetYield.protocol.toLowerCase().includes('jito')) {
    return await fetchExternalBlinkTransaction('jito', 'stake', account, lamports, targetYield.apy);
  }

  if (assetName === 'MSOL' || targetYield.protocol.toLowerCase().includes('marinade')) {
    return await fetchExternalBlinkTransaction('marinade', 'stake', account, lamports, targetYield.apy);
  }

  // Use Jupiter swap
  return await fetchJupiterDirectSwap(account, lamports, outputMint);
}

/**
 * Direct Jupiter swap transaction
 */
async function fetchJupiterDirectSwap(
  account: string,
  lamports: number,
  outputMint: string
): Promise<PostResponse> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  // Get quote
  const quoteRes = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${outputMint}&amount=${lamports}&slippageBps=50`
  );
  
  if (!quoteRes.ok) {
    throw new Error('Jupiter quote failed - API may be rate limited');
  }
  
  const quote = await quoteRes.json();

  // Get swap transaction
  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: account,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!swapRes.ok) {
    const err = await swapRes.text();
    throw new Error(`Jupiter swap transaction failed: ${err}`);
  }

  const swap = await swapRes.json();
  
  const outputAmount = parseInt(quote.outAmount) / 1e6; // Assuming USDC decimals
  const inputAmount = lamports / LAMPORTS_PER_SOL;
  
  return {
    type: 'transaction',
    transaction: swap.swapTransaction,
    message: `Swapping ${inputAmount} SOL → ~${outputAmount.toFixed(2)} output tokens`,
  };
}

/**
 * Fetch live yields from DeFi Llama
 */
async function fetchYields(): Promise<Array<{
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
}>> {
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!res.ok) {
      console.error('DeFi Llama API error:', res.status);
      return getDefaultYields();
    }
    
    const data = await res.json();

    if (!data?.data) return getDefaultYields();

    return data.data
      .filter((p: any) => 
        p.chain === 'Solana' && 
        p.tvlUsd > 100000 && 
        p.apy > 0 &&
        ['kamino', 'jito', 'marinade', 'drift', 'raydium', 'orca'].some(
          proto => p.project?.toLowerCase().includes(proto)
        )
      )
      .map((p: any) => ({
        protocol: p.project || 'Unknown',
        asset: p.symbol || 'Unknown',
        apy: p.apy || 0,
        tvl: p.tvlUsd || 0,
      }))
      .slice(0, 50);
  } catch (err) {
    console.error('Failed to fetch yields:', err);
    return getDefaultYields();
  }
}

/**
 * Default yields for when API fails
 */
function getDefaultYields() {
  return [
    { protocol: 'Jito', asset: 'JitoSOL', apy: 7.5, tvl: 500_000_000 },
    { protocol: 'Marinade', asset: 'mSOL', apy: 6.8, tvl: 400_000_000 },
    { protocol: 'Kamino', asset: 'USDC', apy: 8.2, tvl: 200_000_000 },
    { protocol: 'Drift', asset: 'SOL', apy: 5.5, tvl: 150_000_000 },
  ];
}
