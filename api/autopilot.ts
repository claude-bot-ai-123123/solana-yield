export const config = {
  runtime: 'edge',
};

import { notifyWebhooks, createDecisionEvent } from './lib/webhook-notifier';

/**
 * Autopilot API - Shows autonomous decision-making in action
 * 
 * GET /api/autopilot - Get current decision state
 * POST /api/autopilot - Trigger a decision cycle (demo mode)
 * 
 * Now with webhook integration: Broadcasts decision events to subscribed agents
 */

// Protocols we support
const SUPPORTED_PROTOCOLS = ['kamino', 'drift', 'jito', 'marinade'];

// Demo strategy config
const DEMO_STRATEGY = {
  name: 'balanced',
  riskTolerance: 'medium' as const,
  rebalanceThreshold: 2.0, // 2% APY improvement needed
  maxProtocolConcentration: 0.4,
  maxSlippage: 0.01,
};

interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  pool: string;
}

interface Decision {
  timestamp: string;
  type: 'hold' | 'rebalance' | 'enter';
  confidence: number;
  reasoning: string[];
  recommendation: string | null;
  topOpportunities: YieldOpportunity[];
  analysisDetails: {
    totalOpportunities: number;
    eligibleByRisk: number;
    bestApy: number;
    averageApy: number;
    minTvlChecked: boolean;
  };
}

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // Fetch current yields
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    const allYields: YieldOpportunity[] = data.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd >= 100000)
      .filter((p: any) => SUPPORTED_PROTOCOLS.some(
        proto => p.project.toLowerCase().includes(proto)
      ))
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 50)
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: Math.round(p.apy * 100) / 100,
        tvl: Math.round(p.tvlUsd),
        risk: assessRisk(p),
        pool: p.pool,
      }));

    // Run decision analysis
    const decision = analyzeAndDecide(allYields, DEMO_STRATEGY);

    // Notify webhook subscribers about the decision
    const webhookEvent = createDecisionEvent(decision, DEMO_STRATEGY);
    await notifyWebhooks(webhookEvent);

    // Add metadata
    const result = {
      agent: 'SolanaYield Autopilot',
      version: '1.0.0',
      strategy: DEMO_STRATEGY,
      decision,
      status: {
        isLive: true,
        mode: 'demo', // Would be 'live' with real wallet
        message: 'Autopilot is analyzing yields in real-time. Connect a wallet to enable execution.',
      },
      _meta: {
        dataSource: 'DeFi Llama',
        lastUpdate: new Date().toISOString(),
        supportedProtocols: SUPPORTED_PROTOCOLS,
      },
    };

    return new Response(JSON.stringify(result, null, 2), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Autopilot analysis failed',
      details: String(err),
    }), { status: 500, headers });
  }
}

function assessRisk(pool: any): 'low' | 'medium' | 'high' {
  if (pool.stablecoin) return 'low';
  if (pool.ilRisk === 'yes') return 'high';
  if (pool.apy > 50) return 'high';
  if (pool.apy > 20) return 'medium';
  return 'medium';
}

function analyzeAndDecide(
  yields: YieldOpportunity[], 
  strategy: typeof DEMO_STRATEGY
): Decision {
  const reasoning: string[] = [];
  let confidence = 0.5;

  // Step 1: Filter by risk tolerance
  const riskLevels = { low: 1, medium: 2, high: 3 };
  const eligible = yields.filter(y => 
    riskLevels[y.risk] <= riskLevels[strategy.riskTolerance]
  );

  reasoning.push(`📊 Found ${yields.length} total opportunities on Solana`);
  reasoning.push(`🎯 Filtered to ${eligible.length} within ${strategy.riskTolerance} risk tolerance`);

  if (eligible.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      type: 'hold',
      confidence: 0.9,
      reasoning: [...reasoning, '❌ No opportunities within risk parameters'],
      recommendation: null,
      topOpportunities: [],
      analysisDetails: {
        totalOpportunities: yields.length,
        eligibleByRisk: 0,
        bestApy: 0,
        averageApy: 0,
        minTvlChecked: true,
      },
    };
  }

  // Step 2: Analyze top opportunities
  const topOpp = eligible[0];
  const avgApy = eligible.reduce((sum, y) => sum + y.apy, 0) / eligible.length;

  reasoning.push(`🏆 Best opportunity: ${topOpp.asset} at ${topOpp.apy}% APY on ${topOpp.protocol}`);
  reasoning.push(`📈 Average eligible APY: ${avgApy.toFixed(2)}%`);

  // Step 3: Check TVL safety
  if (topOpp.tvl < 500000) {
    reasoning.push(`⚠️ Top pool TVL ($${topOpp.tvl.toLocaleString()}) is on the lower side`);
    confidence -= 0.15;
  } else {
    reasoning.push(`✅ TVL looks healthy: $${topOpp.tvl.toLocaleString()}`);
    confidence += 0.1;
  }

  // Step 4: Compare to baseline (SOL staking ~6-8%)
  const baseline = 7.0;
  const improvement = topOpp.apy - baseline;
  
  if (improvement < strategy.rebalanceThreshold) {
    reasoning.push(`📉 APY improvement (${improvement.toFixed(1)}%) below threshold (${strategy.rebalanceThreshold}%)`);
    return {
      timestamp: new Date().toISOString(),
      type: 'hold',
      confidence: 0.8,
      reasoning: [...reasoning, '🛑 Recommendation: HOLD current positions'],
      recommendation: 'Current yields do not justify rebalancing costs. Hold existing positions.',
      topOpportunities: eligible.slice(0, 5),
      analysisDetails: {
        totalOpportunities: yields.length,
        eligibleByRisk: eligible.length,
        bestApy: topOpp.apy,
        averageApy: avgApy,
        minTvlChecked: true,
      },
    };
  }

  // Step 5: Strong opportunity found
  confidence = Math.min(0.95, confidence + 0.2);
  reasoning.push(`🚀 ${improvement.toFixed(1)}% improvement over baseline — considering rebalance`);

  // Check concentration limits
  const sameProtocolYields = eligible.filter(y => y.protocol === topOpp.protocol);
  if (sameProtocolYields.length > 5) {
    reasoning.push(`✅ Good diversification options within ${topOpp.protocol}`);
    confidence += 0.05;
  }

  const recommendation = `Rebalance into ${topOpp.asset} (${topOpp.protocol}) for ${topOpp.apy}% APY. ` +
    `This represents a ${improvement.toFixed(1)}% improvement over baseline staking. ` +
    `Pool TVL: $${topOpp.tvl.toLocaleString()}.`;

  return {
    timestamp: new Date().toISOString(),
    type: 'rebalance',
    confidence,
    reasoning: [...reasoning, '✅ Recommendation: REBALANCE to capture higher yields'],
    recommendation,
    topOpportunities: eligible.slice(0, 5),
    analysisDetails: {
      totalOpportunities: yields.length,
      eligibleByRisk: eligible.length,
      bestApy: topOpp.apy,
      averageApy: avgApy,
      minTvlChecked: true,
    },
  };
}
