/**
 * Audit Trail API - Decision Replay Context (Edge Runtime)
 * 
 * GET /api/audit/replay?id=xxx
 * Returns full decision context for replay/debugging
 */

export const config = {
  runtime: 'edge',
};

// Demo decision detail for showcase
const DEMO_DECISIONS: Record<string, any> = {
  '1706918400000-rf2k8m': {
    id: '1706918400000-rf2k8m',
    timestamp: 1706918400000,
    time: '2026-02-03T00:00:00.000Z',
    type: 'rebalance',
    confidence: 0.82,
    executed: true,
    txIds: ['5cGz9XnBhPvHmTzYkQrNpqJmvwRsK3kLxMbYdEfA7hJc'],
    reasoning: `📊 **Risk-Adjusted Analysis**
Found 12 opportunities within risk tolerance

🏆 **Top Recommendation:** USDC on kamino
   • Raw APY: 11.50%
   • Risk-adjusted APY: 9.43%
   • Risk Score: 25/100
   • Sharpe Ratio: 2.31
   • TVL: $89.2M

✅ Audited by OtterSec, Halborn
✅ Insurance fund available
✅ Battle-tested (2+ years)

📈 **Portfolio Comparison**
   • Current APY: 7.20%
   • Projected APY: 11.50%
   • Risk-adjusted improvement: 2.23%

🔄 **Decision: REBALANCE**
Moving to better risk-adjusted opportunities
Risk change: decreased`,
    actions: [
      {
        type: 'withdraw',
        from: { protocol: 'marinade', asset: 'mSOL', amount: 10.5 },
        to: { protocol: 'kamino', asset: 'USDC', amount: 1890 },
        expectedApyGain: 4.3,
      },
    ],
    riskAnalysis: {
      currentRiskScore: 28,
      proposedRiskScore: 25,
      riskChange: 'decreased',
      topOpportunity: {
        protocol: 'kamino',
        asset: 'USDC',
        rawApy: 11.5,
        adjustedApy: 9.43,
        sharpeRatio: 2.31,
        riskScore: 25,
        positives: ['Audited by OtterSec, Halborn', 'Insurance fund available'],
      },
    },
    context: {
      portfolioSnapshot: {
        totalValue: 1890,
        weightedApy: 7.2,
        positions: [
          { protocol: 'marinade', asset: 'mSOL', amount: 10.5, valueUsd: 1890, currentApy: 7.2 },
        ],
      },
      strategyConfig: {
        name: 'Balanced',
        riskTolerance: 'medium',
        rebalanceThreshold: 1.0,
        maxProtocolConcentration: 0.5,
        maxSlippage: 0.01,
      },
      topYieldsAvailable: [
        { protocol: 'kamino', asset: 'USDC', rawApy: 11.5, adjustedApy: 9.43, riskScore: 25, recommendation: 'strong' },
        { protocol: 'drift', asset: 'USDC', rawApy: 10.2, adjustedApy: 7.85, riskScore: 30, recommendation: 'moderate' },
        { protocol: 'jito', asset: 'JitoSOL', rawApy: 7.8, adjustedApy: 6.94, riskScore: 20, recommendation: 'strong' },
        { protocol: 'marinade', asset: 'mSOL', rawApy: 7.2, adjustedApy: 5.88, riskScore: 28, recommendation: 'moderate' },
      ],
    },
  },
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing decision ID',
      usage: '/api/audit/replay?id=1706918400000-rf2k8m',
      availableIds: Object.keys(DEMO_DECISIONS),
    }, null, 2), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const decision = DEMO_DECISIONS[id];

  if (!decision) {
    return new Response(JSON.stringify({
      success: false,
      error: `Decision not found: ${id}`,
      availableIds: Object.keys(DEMO_DECISIONS),
    }, null, 2), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Return replay context with full decision information
  return new Response(JSON.stringify({
    success: true,
    description: 'Full decision replay context - see exactly what the agent saw and why',
    decision: {
      id: decision.id,
      timestamp: decision.timestamp,
      time: decision.time,
      type: decision.type,
      confidence: decision.confidence,
      executed: decision.executed,
      txIds: decision.txIds,
      reasoning: decision.reasoning,
      actions: decision.actions,
      riskAnalysis: decision.riskAnalysis,
    },
    fullContext: {
      portfolio: decision.context.portfolioSnapshot,
      strategy: decision.context.strategyConfig,
      availableYields: decision.context.topYieldsAvailable,
    },
    previousDecisions: [
      {
        id: '1706914800000-k4m9q2',
        timestamp: 1706914800000,
        time: '2026-02-02T23:00:00.000Z',
        type: 'hold',
        confidence: 0.91,
        executed: false,
        summary: 'Held position - improvement below threshold',
      },
      {
        id: '1706911200000-p8n3x7',
        timestamp: 1706911200000,
        time: '2026-02-02T22:00:00.000Z',
        type: 'enter',
        confidence: 0.78,
        executed: true,
        summary: 'Initial entry to Marinade mSOL',
      },
    ],
    summaryMarkdown: `# Decision Replay Summary

**Decision ID:** ${decision.id}
**Time:** ${decision.time}
**Type:** ${decision.type.toUpperCase()}
**Confidence:** ${(decision.confidence * 100).toFixed(0)}%
**Executed:** ${decision.executed ? '✅ Yes' : '❌ No'}

## What the Agent Saw

### Portfolio State
- Total Value: $${decision.context.portfolioSnapshot.totalValue.toFixed(2)}
- Current APY: ${decision.context.portfolioSnapshot.weightedApy.toFixed(2)}%
- Position: ${decision.context.portfolioSnapshot.positions[0].amount} ${decision.context.portfolioSnapshot.positions[0].asset} on ${decision.context.portfolioSnapshot.positions[0].protocol}

### Strategy Settings
- Risk Tolerance: ${decision.context.strategyConfig.riskTolerance}
- Rebalance Threshold: ${decision.context.strategyConfig.rebalanceThreshold}%
- Max Protocol Concentration: ${(decision.context.strategyConfig.maxProtocolConcentration * 100)}%

### Top Available Opportunities
${decision.context.topYieldsAvailable.slice(0, 3).map((y: any, i: number) => 
  `${i + 1}. ${y.asset} on ${y.protocol}: ${y.rawApy}% APY (${y.adjustedApy.toFixed(2)}% risk-adjusted)`
).join('\n')}

## Risk Analysis
- Current Risk Score: ${decision.riskAnalysis.currentRiskScore}/100
- Proposed Risk Score: ${decision.riskAnalysis.proposedRiskScore}/100
- Risk Change: ${decision.riskAnalysis.riskChange}

## Why This Decision

\`\`\`
${decision.reasoning}
\`\`\`

## Execution Result
${decision.executed ? 
  `✅ Successfully executed
Transaction: ${decision.txIds?.[0] || 'N/A'}` : 
  `⏸️ Not executed (${decision.type === 'hold' ? 'holding current position' : 'manual approval required'})`}
`,
    transparency: {
      note: 'This replay shows the complete decision context',
      whatYouSee: [
        'Exact portfolio state at decision time',
        'Strategy configuration used',
        'All yield opportunities considered',
        'Risk analysis and scoring',
        'Full reasoning chain',
        'Previous decisions for context',
      ],
      purpose: 'Complete transparency for regulatory compliance and user trust',
    },
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
