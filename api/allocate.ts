/**
 * VaultGate Allocation Endpoint
 * 
 * GET /api/allocate?risk=moderate&amount=1000
 * 
 * Returns recommended protocol/amount splits for vault systems to consume
 * yield intelligence.
 * 
 * Risk levels: conservative | moderate | aggressive
 */

export const config = {
  runtime: 'edge',
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  stablecoin: boolean;
  riskScore: number;
}

interface Allocation {
  protocol: string;
  asset: string;
  percentage: number;
  amount: number;
  expectedApy: number;
  tvl: number;
  riskScore: number;
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed. Use GET.' 
    }), { status: 405, headers });
  }

  const url = new URL(request.url);
  const riskParam = url.searchParams.get('risk') || 'moderate';
  const amountParam = url.searchParams.get('amount') || '1000';

  // Normalize risk level
  const riskLevel = normalizeRiskLevel(riskParam);
  const amount = parseFloat(amountParam);

  if (isNaN(amount) || amount <= 0) {
    return new Response(JSON.stringify({ 
      error: 'Invalid amount. Must be a positive number.' 
    }), { status: 400, headers });
  }

  try {
    // Fetch yields from DeFi Llama
    const yields = await fetchYields();
    
    // Filter and score based on risk tolerance
    const eligible = filterByRisk(yields, riskLevel);
    
    if (eligible.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No opportunities match the specified risk level.',
        riskLevel,
      }), { status: 404, headers });
    }

    // Generate allocation strategy
    const allocations = generateAllocations(eligible, amount, riskLevel);
    
    const weightedApy = allocations.reduce((sum, a) => sum + (a.expectedApy * a.percentage / 100), 0);
    const avgRiskScore = allocations.reduce((sum, a) => sum + (a.riskScore * a.percentage / 100), 0);

    return new Response(JSON.stringify({
      request: {
        riskLevel,
        amount,
      },
      summary: {
        totalAmount: amount,
        expectedApy: parseFloat(weightedApy.toFixed(2)),
        averageRiskScore: parseFloat(avgRiskScore.toFixed(1)),
        diversification: allocations.length,
        protocols: allocations.map(a => a.protocol),
      },
      allocations: allocations.map(a => ({
        protocol: a.protocol,
        asset: a.asset,
        percentage: a.percentage,
        amount: parseFloat(a.amount.toFixed(2)),
        expectedApy: parseFloat(a.expectedApy.toFixed(2)),
        tvl: a.tvl,
        riskScore: a.riskScore,
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'DeFi Llama',
      },
      disclaimer: 'Not financial advice. DeFi carries risks including smart contract vulnerabilities and impermanent loss.',
    }), { headers });

  } catch (err) {
    console.error('Allocation error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate allocation strategy',
      details: String(err),
    }), { status: 500, headers });
  }
}

function normalizeRiskLevel(risk: string): 'conservative' | 'moderate' | 'aggressive' {
  const lower = risk.toLowerCase();
  if (lower === 'conservative' || lower === 'low') return 'conservative';
  if (lower === 'aggressive' || lower === 'high') return 'aggressive';
  return 'moderate';
}

async function fetchYields(): Promise<YieldOpp[]> {
  const response = await fetch('https://yields.llama.fi/pools');
  const data = await response.json();
  
  return data.data
    .filter((p: any) => 
      p.chain === 'Solana' && 
      p.tvlUsd >= 100000 && 
      p.apy > 0 &&
      p.apy < 200 // Filter out unrealistic APYs
    )
    .map((p: any) => {
      const protocol = normalizeProtocol(p.project);
      const riskScore = calculateRiskScore(p, protocol);
      
      return {
        protocol,
        asset: p.symbol,
        apy: p.apy,
        tvl: p.tvlUsd,
        stablecoin: Boolean(p.stablecoin),
        riskScore,
      };
    });
}

function normalizeProtocol(project: string): string {
  const lower = project.toLowerCase();
  if (lower.includes('kamino')) return 'Kamino';
  if (lower.includes('drift')) return 'Drift';
  if (lower.includes('jito')) return 'Jito';
  if (lower.includes('marinade')) return 'Marinade';
  if (lower.includes('orca')) return 'Orca';
  if (lower.includes('raydium')) return 'Raydium';
  if (lower.includes('marginfi')) return 'MarginFi';
  return project;
}

function calculateRiskScore(pool: any, protocol: string): number {
  // Risk factors: protocol reputation, TVL, APY sustainability, asset type
  let score = 50; // Base risk

  // Protocol reputation (lower is better)
  const trustedProtocols = ['Kamino', 'Drift', 'Jito', 'Marinade', 'Orca'];
  if (trustedProtocols.includes(protocol)) {
    score -= 20;
  }

  // TVL (higher TVL = lower risk)
  const tvl = pool.tvlUsd;
  if (tvl > 100_000_000) score -= 15;
  else if (tvl > 10_000_000) score -= 10;
  else if (tvl > 1_000_000) score -= 5;
  else if (tvl < 500_000) score += 10;

  // APY sustainability (very high APY = higher risk)
  const apy = pool.apy;
  if (apy > 100) score += 30;
  else if (apy > 50) score += 20;
  else if (apy > 25) score += 10;
  else if (apy < 10) score -= 5;

  // Asset type (stablecoins = lower risk)
  if (pool.stablecoin) {
    score -= 15;
  } else {
    const asset = pool.symbol.toLowerCase();
    if (asset.includes('sol')) score += 5;
    else if (!asset.includes('btc') && !asset.includes('eth')) score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function filterByRisk(yields: YieldOpp[], riskLevel: 'conservative' | 'moderate' | 'aggressive'): YieldOpp[] {
  const maxRisk = {
    conservative: 35,
    moderate: 55,
    aggressive: 75,
  }[riskLevel];

  const minTvl = {
    conservative: 10_000_000,
    moderate: 1_000_000,
    aggressive: 500_000,
  }[riskLevel];

  return yields
    .filter(y => y.riskScore <= maxRisk && y.tvl >= minTvl)
    .sort((a, b) => {
      // Prioritize risk-adjusted returns
      const scoreA = a.apy / (1 + a.riskScore / 100);
      const scoreB = b.apy / (1 + b.riskScore / 100);
      return scoreB - scoreA;
    });
}

function generateAllocations(
  eligible: YieldOpp[], 
  totalAmount: number,
  riskLevel: 'conservative' | 'moderate' | 'aggressive'
): Allocation[] {
  // Determine diversification level
  const maxAssets = {
    conservative: 5, // More diversification for conservative
    moderate: 4,
    aggressive: 3,   // Less diversification for aggressive
  }[riskLevel];

  const top = eligible.slice(0, maxAssets);

  // Weight by risk-adjusted APY
  const weights = top.map(opp => {
    const riskAdjustment = 1 + (opp.riskScore / 100);
    return opp.apy / riskAdjustment;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  return top.map((opp, i) => {
    const percentage = (weights[i] / totalWeight) * 100;
    const amount = (percentage / 100) * totalAmount;

    return {
      protocol: opp.protocol,
      asset: opp.asset,
      percentage: parseFloat(percentage.toFixed(2)),
      amount,
      expectedApy: opp.apy,
      tvl: opp.tvl,
      riskScore: opp.riskScore,
    };
  });
}
