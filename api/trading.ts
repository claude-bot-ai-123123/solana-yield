/**
 * /api/trading - Live Autonomous Trading API
 * Edge runtime for fast response
 */

export const config = {
  runtime: 'edge',
};

// Fetch yields directly from DefiLlama
async function fetchYields() {
  const res = await fetch('https://yields.llama.fi/pools');
  const data = await res.json();
  return data.data
    .filter((p: any) => p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy > 0)
    .slice(0, 30)
    .map((p: any) => ({
      protocol: p.project,
      asset: p.symbol,
      apy: p.apy,
      tvl: p.tvlUsd,
      risk: p.apy > 50 ? 'high' : p.apy > 20 ? 'medium' : 'low',
    }));
}

// Risk-adjust yields
function analyzeYields(yields: any[], maxRiskScore: number) {
  return yields.map((y: any) => {
    const riskScore = y.risk === 'high' ? 70 : y.risk === 'medium' ? 45 : 25;
    const riskPenalty = riskScore / 100 * 0.6;
    const tvlBonus = Math.min(y.tvl / 10000000, 0.15);
    const adjustedApy = y.apy * (1 - riskPenalty) * (1 + tvlBonus);
    
    return {
      ...y,
      riskScore,
      adjustedApy: parseFloat(adjustedApy.toFixed(2)),
      sharpeRatio: parseFloat((adjustedApy / (riskPenalty * 100 + 10)).toFixed(2)),
      warnings: riskScore > 60 ? ['High risk - volatile APY'] : [],
      positives: y.tvl > 5000000 ? ['High TVL - good liquidity'] : [],
    };
  })
  .filter((y: any) => y.riskScore <= maxRiskScore)
  .sort((a: any, b: any) => b.adjustedApy - a.adjustedApy);
}

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';
  
  try {
    switch (action) {
      case 'demo':
        return handleDemo(headers);
      case 'simulate':
        return handleSimulate(url, headers);
      default:
        return handleOverview(headers);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
}

function handleOverview(headers: Record<string, string>) {
  return new Response(JSON.stringify({
    name: 'SolanaYield Live Trading API',
    version: '1.0.0',
    description: 'Live autonomous trading control for AI agents on Solana',
    
    status: {
      enabled: false,
      reason: 'Serverless deployment - no persistent state',
      solution: 'Run full server locally for live trading',
    },
    
    tradingModes: {
      manual: 'Agent provides recommendations, human executes',
      monitoring: 'Agent monitors and alerts, no auto-execution',
      autonomous: 'Full autonomous execution with safety rails',
    },
    
    safetyFeatures: [
      'Max trade size limit ($500 default)',
      'Daily volume limits ($2000 default)',
      'Consecutive loss circuit breaker',
      'Drawdown circuit breaker (10% max)',
      'Manual approval for large trades',
      'Emergency stop capability',
      'Real-time position monitoring',
      'Full audit trail of all decisions',
    ],
    
    architecture: {
      core: 'TradingModeManager - Event-driven state machine',
      execution: 'TransactionQueue with rate limiting',
      streaming: 'WebSocket/SSE for real-time updates',
      safety: 'CircuitBreakers with configurable thresholds',
      audit: 'DecisionHistoryStore for compliance',
    },
    
    endpoints: {
      'GET /api/trading': 'This overview',
      'GET /api/trading?action=demo': 'Simulated trading state with real yields',
      'GET /api/trading?action=simulate&risk=medium': 'Simulate autonomous decision',
    },
    
    codeLocation: {
      tradingMode: 'src/lib/trading-mode.ts (850+ lines)',
      websocket: 'src/lib/websocket.ts',
      server: 'src/server.ts (with /trading/* routes)',
    },
    
    fullServerEndpoints: [
      '/trading/status', '/trading/config', '/trading/pending',
      '/trading/start', '/trading/stop', '/trading/mode',
      '/trading/stream', '/trading/approve', '/trading/reject',
    ],
  }), { headers });
}

async function handleDemo(headers: Record<string, string>) {
  const yields = await fetchYields();
  const analyzed = analyzeYields(yields, 75);
  
  const demoState = {
    mode: 'monitoring',
    isActive: true,
    isPaused: false,
    
    stats: {
      tradesExecutedToday: 3,
      totalVolumeToday: 1250.00,
      consecutiveLosses: 0,
      currentDrawdown: 2.3,
      peakValue: 5000.00,
    },
    
    portfolio: {
      totalValue: 4885.00,
      weightedApy: 8.5,
      positions: [
        { protocol: 'kamino', asset: 'USDC', amount: 2500, currentApy: 12.5 },
        { protocol: 'jito', asset: 'SOL', amount: 12.5, currentApy: 7.2 },
      ],
    },
    
    currentYields: analyzed.slice(0, 10),
    
    pendingTrades: [{
      id: 'demo_' + Date.now().toString(36),
      status: 'pending',
      estimatedValueUsd: 500,
      requiresApproval: true,
      action: {
        type: 'rebalance',
        to: { protocol: analyzed[0]?.protocol, asset: analyzed[0]?.asset },
        expectedApyGain: 2.5,
      },
    }],
    
    lastDecision: {
      timestamp: Date.now() - 15 * 60 * 1000,
      type: 'hold',
      confidence: 0.85,
      reasoning: `Portfolio performing well. Top opportunity: ${analyzed[0]?.asset} at ${analyzed[0]?.adjustedApy}% risk-adjusted APY.`,
    },
    
    config: {
      maxTradeValueUsd: 500,
      maxDailyTradesUsd: 2000,
      maxConsecutiveLosses: 3,
      maxDrawdownPercent: 10,
      requireApprovalAboveUsd: 100,
    },
    
    sessionId: 'demo_' + Date.now().toString(36),
  };
  
  return new Response(JSON.stringify({ 
    success: true, 
    demo: true, 
    state: demoState,
    _note: 'This is simulated data with real yield feeds. Run full server for live trading.',
  }), { headers });
}

async function handleSimulate(url: URL, headers: Record<string, string>) {
  const riskTolerance = url.searchParams.get('risk') || 'medium';
  const threshold = parseFloat(url.searchParams.get('threshold') || '2.0');
  const maxRiskScore = riskTolerance === 'low' ? 35 : riskTolerance === 'high' ? 75 : 55;
  
  const yields = await fetchYields();
  const analyzed = analyzeYields(yields, maxRiskScore);
  
  if (analyzed.length === 0) {
    return new Response(JSON.stringify({
      simulation: true,
      timestamp: Date.now(),
      decision: { type: 'hold', confidence: 0.9, reasoning: 'No opportunities within risk tolerance' },
      input: { riskTolerance, maxRiskScore, threshold },
    }), { headers });
  }
  
  const best = analyzed[0];
  const currentApy = 5.2;
  const improvement = best.adjustedApy - currentApy;
  
  const reasoning = [
    `📊 **Autonomous Decision Simulation**`,
    `Risk tolerance: ${riskTolerance} (max score: ${maxRiskScore})`,
    `Found ${analyzed.length} opportunities`,
    '',
    `**Best Opportunity**`,
    `• ${best.asset} on ${best.protocol}`,
    `• Raw APY: ${best.apy.toFixed(2)}% → Adjusted: ${best.adjustedApy.toFixed(2)}%`,
    `• Risk: ${best.riskScore}/100 | TVL: $${(best.tvl / 1e6).toFixed(1)}M`,
    '',
    `**Analysis**: Improvement of ${improvement.toFixed(2)}% vs threshold ${threshold}%`,
  ].join('\n');
  
  const decision = improvement < threshold
    ? { type: 'hold', confidence: 0.85, reasoning: reasoning + '\n\n⏸️ **HOLD** - Below threshold' }
    : { 
        type: 'rebalance', 
        confidence: Math.min(0.95, 0.7 + improvement / 20),
        reasoning: reasoning + `\n\n🔄 **REBALANCE** - Move to ${best.asset}`,
        actions: [{
          type: 'withdraw',
          from: { protocol: 'current', asset: 'SOL' },
          to: { protocol: best.protocol, asset: best.asset },
          expectedApyGain: improvement,
        }],
      };
  
  return new Response(JSON.stringify({
    simulation: true,
    timestamp: Date.now(),
    decision,
    riskAnalysis: {
      currentRiskScore: 50,
      proposedRiskScore: best.riskScore,
      riskChange: best.riskScore < 50 ? 'decreased' : 'increased',
      topOpportunity: {
        protocol: best.protocol,
        asset: best.asset,
        rawApy: best.apy,
        adjustedApy: best.adjustedApy,
        riskScore: best.riskScore,
        sharpeRatio: best.sharpeRatio,
      },
    },
    topRecommendations: analyzed.slice(0, 5),
    input: { riskTolerance, threshold, maxRiskScore },
  }), { headers });
}
