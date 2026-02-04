/**
 * API: POST /api/rebalance
 * 
 * AI-powered portfolio rebalancing recommendations.
 * Analyzes current holdings vs optimal allocation based on:
 * - Current yield opportunities
 * - Macro risk conditions (WARGAMES)
 * - Risk preferences
 * - Diversification requirements
 */

export const config = {
  runtime: 'edge',
};

interface Position {
  protocol: string;
  asset: string;
  amount: number;
  currentApy: number;
}

interface RebalanceRequest {
  currentPositions: Position[];
  totalValue: number;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  minProtocolAllocation?: number; // Minimum $ per protocol
}

interface RebalanceAction {
  action: 'withdraw' | 'deposit' | 'hold';
  protocol: string;
  asset: string;
  amount: number;
  fromAmount: number;
  toAmount: number;
  reason: string;
}

interface RebalanceResponse {
  currentAllocation: {
    protocol: string;
    amount: number;
    percentage: number;
    apy: number;
  }[];
  targetAllocation: {
    protocol: string;
    amount: number;
    percentage: number;
    expectedApy: number;
  }[];
  actions: RebalanceAction[];
  expectedApyIncrease: number;
  riskAssessment: {
    current: string;
    target: string;
    macroRisk: number;
  };
  reasoning: string;
  timestamp: string;
}

async function fetchYields() {
  const response = await fetch('https://yields.llama.fi/pools');
  const data = await response.json();
  
  return data.data
    .filter((p: any) => p.chain === 'Solana')
    .sort((a: any, b: any) => b.apy - a.apy)
    .slice(0, 20); // Top 20 Solana yields
}

async function fetchMacroRisk() {
  try {
    const response = await fetch('https://wargames-api.vercel.app/live/risk');
    if (!response.ok) return { score: 50, ceiling: 70 }; // Conservative fallback
    const data = await response.json();
    
    // Calculate allocation ceiling based on risk score
    let ceiling = 70;
    if (data.score <= 25) ceiling = 90;
    else if (data.score <= 50) ceiling = 70;
    else if (data.score <= 75) ceiling = 50;
    else ceiling = 30;
    
    return { score: data.score, ceiling };
  } catch {
    return { score: 50, ceiling: 70 };
  }
}

function calculateTargetAllocation(
  yields: any[],
  totalValue: number,
  riskTolerance: string,
  macroRiskCeiling: number,
  minProtocolAllocation: number
) {
  // Filter yields based on risk tolerance and TVL
  const minTvl = riskTolerance === 'conservative' ? 10_000_000 :
                 riskTolerance === 'moderate' ? 5_000_000 : 1_000_000;
  
  const eligiblePools = yields.filter(p => {
    const tvl = p.tvlUsd || 0;
    return tvl >= minTvl;
  });

  // Top protocols by APY and safety
  const topProtocols = eligiblePools
    .slice(0, 8) // Top 8 protocols
    .map(p => ({
      protocol: p.project || 'Unknown',
      symbol: p.symbol || 'USDC',
      apy: p.apy || 0,
      tvl: p.tvlUsd || 0,
      poolMeta: p.poolMeta || '',
    }));

  // Apply macro risk ceiling
  const maxAllocation = (totalValue * macroRiskCeiling) / 100;
  
  // Diversification: allocate across top protocols
  const numProtocols = Math.min(5, topProtocols.length);
  const baseAllocation = maxAllocation / numProtocols;
  
  const allocation = topProtocols.slice(0, numProtocols).map((p, i) => {
    // Weight higher APY slightly more
    const weight = 1 + (0.1 * (numProtocols - i));
    const amount = Math.max(
      baseAllocation * weight,
      minProtocolAllocation
    );
    
    return {
      protocol: p.protocol,
      asset: p.symbol,
      amount,
      percentage: (amount / totalValue) * 100,
      expectedApy: p.apy,
    };
  });

  // Normalize to fit within macro ceiling
  const totalAllocated = allocation.reduce((sum, a) => sum + a.amount, 0);
  if (totalAllocated > maxAllocation) {
    const scale = maxAllocation / totalAllocated;
    allocation.forEach(a => {
      a.amount *= scale;
      a.percentage = (a.amount / totalValue) * 100;
    });
  }

  return allocation;
}

function generateRebalanceActions(
  currentPositions: Position[],
  targetAllocation: any[]
): RebalanceAction[] {
  const actions: RebalanceAction[] = [];
  
  // Build current holdings map
  const currentMap = new Map<string, Position>();
  currentPositions.forEach(p => {
    const key = `${p.protocol}-${p.asset}`;
    currentMap.set(key, p);
  });

  // Build target map
  const targetMap = new Map<string, any>();
  targetAllocation.forEach(t => {
    const key = `${t.protocol}-${t.asset}`;
    targetMap.set(key, t);
  });

  // Find positions to reduce/exit
  currentMap.forEach((pos, key) => {
    const target = targetMap.get(key);
    const targetAmount = target?.amount || 0;
    
    if (targetAmount < pos.amount) {
      const diff = pos.amount - targetAmount;
      actions.push({
        action: targetAmount === 0 ? 'withdraw' : 'withdraw',
        protocol: pos.protocol,
        asset: pos.asset,
        amount: diff,
        fromAmount: pos.amount,
        toAmount: targetAmount,
        reason: targetAmount === 0 
          ? `Exit ${pos.protocol} - better opportunities elsewhere`
          : `Reduce ${pos.protocol} position for diversification`,
      });
    } else if (targetAmount > pos.amount) {
      const diff = targetAmount - pos.amount;
      actions.push({
        action: 'deposit',
        protocol: pos.protocol,
        asset: pos.asset,
        amount: diff,
        fromAmount: pos.amount,
        toAmount: targetAmount,
        reason: `Increase ${pos.protocol} allocation - strong yield (${target.expectedApy.toFixed(2)}% APY)`,
      });
    }
  });

  // Find new positions to enter
  targetMap.forEach((target, key) => {
    if (!currentMap.has(key)) {
      actions.push({
        action: 'deposit',
        protocol: target.protocol,
        asset: target.asset,
        amount: target.amount,
        fromAmount: 0,
        toAmount: target.amount,
        reason: `New position - high yield (${target.expectedApy.toFixed(2)}% APY) with acceptable risk`,
      });
    }
  });

  return actions;
}

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body: RebalanceRequest = await request.json();
    
    if (!body.currentPositions || !body.totalValue) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: currentPositions, totalValue' 
      }), {
        status: 400,
        headers,
      });
    }

    // Fetch current market data
    const [yields, macroRisk] = await Promise.all([
      fetchYields(),
      fetchMacroRisk(),
    ]);

    const riskTolerance = body.riskTolerance || 'moderate';
    const minProtocolAllocation = body.minProtocolAllocation || 1000;

    // Calculate current allocation
    const currentAllocation = body.currentPositions.map(p => ({
      protocol: p.protocol,
      amount: p.amount,
      percentage: (p.amount / body.totalValue) * 100,
      apy: p.currentApy,
    }));

    const currentWeightedApy = body.currentPositions.reduce(
      (sum, p) => sum + (p.currentApy * (p.amount / body.totalValue)),
      0
    );

    // Calculate target allocation
    const targetAllocation = calculateTargetAllocation(
      yields,
      body.totalValue,
      riskTolerance,
      macroRisk.ceiling,
      minProtocolAllocation
    );

    const targetWeightedApy = targetAllocation.reduce(
      (sum, a) => sum + (a.expectedApy * (a.amount / body.totalValue)),
      0
    );

    // Generate rebalance actions
    const actions = generateRebalanceActions(
      body.currentPositions,
      targetAllocation
    );

    const apyIncrease = targetWeightedApy - currentWeightedApy;

    // Risk assessment
    const currentRisk = body.currentPositions.length < 3 ? 'Concentrated' :
                       body.currentPositions.length < 5 ? 'Moderate' : 'Diversified';
    const targetRisk = targetAllocation.length < 3 ? 'Concentrated' :
                      targetAllocation.length < 5 ? 'Moderate' : 'Diversified';

    const reasoning = `
Based on current market conditions (macro risk: ${macroRisk.score}/100):
- ${actions.length} rebalancing actions recommended
- Expected APY increase: ${apyIncrease.toFixed(2)}% (${currentWeightedApy.toFixed(2)}% → ${targetWeightedApy.toFixed(2)}%)
- Allocation ceiling: ${macroRisk.ceiling}% of portfolio (risk-adjusted)
- Diversification: ${currentRisk} → ${targetRisk}
- Risk tolerance: ${riskTolerance}

${macroRisk.score > 50 ? '⚠️ Elevated macro risk detected - conservative allocation applied' : ''}
${apyIncrease > 2 ? '✨ Significant yield improvement opportunity detected' : ''}
    `.trim();

    const response: RebalanceResponse = {
      currentAllocation,
      targetAllocation,
      actions,
      expectedApyIncrease: apyIncrease,
      riskAssessment: {
        current: currentRisk,
        target: targetRisk,
        macroRisk: macroRisk.score,
      },
      reasoning,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Rebalance API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers,
    });
  }
}
