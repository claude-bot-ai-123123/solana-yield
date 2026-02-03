export const config = { runtime: 'edge' };

// ============================================================================
// Types & Constants
// ============================================================================

interface Strategy {
  name: string;
  riskTolerance: 'low' | 'medium' | 'high';
  rebalanceThreshold: number;
  maxProtocolConcentration: number;
  maxSlippage: number;
}

interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

interface WhatIfScenario {
  name: string;
  description: string;
  modifiedStrategy: Partial<Strategy>;
}

const PREDEFINED_SCENARIOS: WhatIfScenario[] = [
  { name: 'aggressive', description: 'What if I had chosen high risk tolerance?', modifiedStrategy: { riskTolerance: 'high' } },
  { name: 'conservative', description: 'What if I had been more cautious (low risk)?', modifiedStrategy: { riskTolerance: 'low' } },
  { name: 'yield-hunter', description: 'What if I had lower rebalance threshold?', modifiedStrategy: { rebalanceThreshold: 0.5 } },
  { name: 'concentrated', description: 'What if I allowed 80% concentration?', modifiedStrategy: { maxProtocolConcentration: 0.8 } },
  { name: 'diversified', description: 'What if max 25% per protocol?', modifiedStrategy: { maxProtocolConcentration: 0.25 } },
];

const DEMO_YIELDS: YieldOpportunity[] = [
  { protocol: 'kamino', asset: 'USDC', apy: 9.5, tvl: 450_000_000, risk: 'low' },
  { protocol: 'drift', asset: 'USDC', apy: 7.5, tvl: 320_000_000, risk: 'low' },
  { protocol: 'jito', asset: 'SOL', apy: 8.1, tvl: 1_200_000_000, risk: 'low' },
  { protocol: 'marinade', asset: 'mSOL', apy: 7.8, tvl: 800_000_000, risk: 'low' },
  { protocol: 'lulo', asset: 'USDC', apy: 12.5, tvl: 85_000_000, risk: 'medium' },
  { protocol: 'mango', asset: 'USDC', apy: 15.2, tvl: 45_000_000, risk: 'high' },
  { protocol: 'orca', asset: 'SOL-USDC', apy: 22.5, tvl: 35_000_000, risk: 'high' },
  { protocol: 'pump.fun', asset: 'MEME', apy: 85.0, tvl: 5_000_000, risk: 'high' },
];

const DEFAULT_STRATEGY: Strategy = {
  name: 'Balanced',
  riskTolerance: 'medium',
  rebalanceThreshold: 1.0,
  maxProtocolConcentration: 0.4,
  maxSlippage: 0.01,
};

// ============================================================================
// Simulation Logic
// ============================================================================

function getRiskMaxScore(tolerance: 'low' | 'medium' | 'high'): number {
  return tolerance === 'low' ? 35 : tolerance === 'high' ? 75 : 55;
}

function getOpportunityRiskScore(opp: YieldOpportunity): number {
  let base = opp.risk === 'low' ? 20 : opp.risk === 'medium' ? 45 : 70;
  if (opp.tvl < 10_000_000) base += 15;
  else if (opp.tvl < 50_000_000) base += 10;
  else if (opp.tvl < 100_000_000) base += 5;
  else if (opp.tvl > 500_000_000) base -= 5;
  if (opp.apy > 50) base += 20;
  else if (opp.apy > 20) base += 10;
  else if (opp.apy > 15) base += 5;
  return Math.min(100, Math.max(0, base));
}

function getAdjustedApy(opp: YieldOpportunity, riskScore: number): number {
  const riskPenalty = riskScore / 100 * 0.5;
  return opp.apy * (1 - riskPenalty);
}

function simulateScenario(scenario: WhatIfScenario, originalStrategy: Strategy, yields: YieldOpportunity[]) {
  const originalMaxRisk = getRiskMaxScore(originalStrategy.riskTolerance);
  const originalEligible = yields
    .map(y => ({ ...y, riskScore: getOpportunityRiskScore(y), adjustedApy: getAdjustedApy(y, getOpportunityRiskScore(y)) }))
    .filter(y => y.riskScore <= originalMaxRisk)
    .sort((a, b) => b.adjustedApy - a.adjustedApy);
  const originalTop = originalEligible[0] || null;

  const modifiedStrategy: Strategy = { ...originalStrategy, ...scenario.modifiedStrategy };
  const modifiedMaxRisk = getRiskMaxScore(modifiedStrategy.riskTolerance);
  const modifiedEligible = yields
    .map(y => ({ ...y, riskScore: getOpportunityRiskScore(y), adjustedApy: getAdjustedApy(y, getOpportunityRiskScore(y)) }))
    .filter(y => y.riskScore <= modifiedMaxRisk)
    .sort((a, b) => b.adjustedApy - a.adjustedApy);
  const modifiedTop = modifiedEligible[0] || null;

  const reasoning: string[] = [];
  reasoning.push(`Analyzed ${yields.length} opportunities with modified ${Object.keys(scenario.modifiedStrategy).join(', ')}`);
  reasoning.push(`Risk tolerance: ${modifiedStrategy.riskTolerance} (max score: ${modifiedMaxRisk})`);
  reasoning.push(`${modifiedEligible.length} opportunities within risk tolerance`);
  if (modifiedTop) {
    reasoning.push(`Top choice: ${modifiedTop.asset} on ${modifiedTop.protocol}`);
    reasoning.push(`  Raw APY: ${modifiedTop.apy.toFixed(1)}% → Adjusted: ${modifiedTop.adjustedApy.toFixed(1)}%`);
    reasoning.push(`  Risk score: ${modifiedTop.riskScore}/100`);
  }

  const wouldHaveChanged = (originalTop?.protocol !== modifiedTop?.protocol) || (originalTop?.asset !== modifiedTop?.asset);
  const apyDelta = (modifiedTop?.adjustedApy || 0) - (originalTop?.adjustedApy || 0);
  const riskDelta = (modifiedTop?.riskScore || 0) - (originalTop?.riskScore || 0);

  const insights: string[] = [];
  if (scenario.modifiedStrategy.riskTolerance === 'high' && riskDelta > 10) insights.push(`⚠️ Higher risk tolerance exposes you to ${riskDelta} points more risk`);
  if (scenario.modifiedStrategy.riskTolerance === 'low' && riskDelta < -10) insights.push(`🛡️ Lower risk tolerance reduces risk by ${Math.abs(riskDelta)} points`);
  if (apyDelta > 2) insights.push(`📈 This strategy yields ${apyDelta.toFixed(1)}% more APY`);
  else if (apyDelta < -2) insights.push(`📉 This strategy yields ${Math.abs(apyDelta).toFixed(1)}% less APY`);
  if (modifiedTop && modifiedTop.riskScore > 60) insights.push(`🎲 Top choice has elevated risk score: ${modifiedTop.riskScore}/100`);

  const actionDiff: string[] = [];
  if (wouldHaveChanged) {
    if (modifiedTop) actionDiff.push(`+ Would deposit into ${modifiedTop.asset} on ${modifiedTop.protocol}`);
    if (originalTop) actionDiff.push(`- Would NOT use ${originalTop.asset} on ${originalTop.protocol}`);
  }

  let verdict: 'better' | 'worse' | 'similar' | 'riskier';
  if (!wouldHaveChanged) verdict = 'similar';
  else if (apyDelta > 1 && riskDelta <= 5) verdict = 'better';
  else if (apyDelta > 1 && riskDelta > 10) verdict = 'riskier';
  else if (apyDelta < -1) verdict = 'worse';
  else verdict = 'similar';

  const summary = !wouldHaveChanged
    ? 'The agent would have made the same decision with these parameters.'
    : `The agent would have chosen ${modifiedTop?.asset || 'differently'}. APY ${apyDelta >= 0 ? '+' : ''}${apyDelta.toFixed(1)}%, Risk ${riskDelta >= 0 ? '+' : ''}${riskDelta} points.`;

  const alternatives = modifiedEligible.slice(0, 5).map(opp => ({
    protocol: opp.protocol,
    asset: opp.asset,
    rawApy: parseFloat(opp.apy.toFixed(2)),
    adjustedApy: parseFloat(opp.adjustedApy.toFixed(2)),
    riskScore: opp.riskScore,
    wouldHaveChosen: opp.protocol === modifiedTop?.protocol && opp.asset === modifiedTop?.asset,
    reason: opp.protocol === modifiedTop?.protocol && opp.asset === modifiedTop?.asset ? 'Top choice with modified strategy' : 'Alternative option',
  }));

  return {
    scenario: { name: scenario.name, description: scenario.description, changes: scenario.modifiedStrategy },
    originalDecision: {
      type: originalTop ? 'rebalance' : 'hold',
      confidence: '85%',
      choice: originalTop ? `${originalTop.asset} on ${originalTop.protocol}` : 'Hold current positions',
      projectedApy: `${(originalTop?.adjustedApy || 0).toFixed(1)}%`,
      riskScore: originalTop?.riskScore || 0,
    },
    simulatedDecision: {
      type: modifiedTop ? 'rebalance' : 'hold',
      confidence: '80%',
      choice: modifiedTop ? `${modifiedTop.asset} on ${modifiedTop.protocol}` : 'Hold current positions',
      projectedApy: `${(modifiedTop?.adjustedApy || 0).toFixed(1)}%`,
      riskScore: modifiedTop?.riskScore || 0,
      reasoning,
    },
    comparison: {
      verdict,
      verdictEmoji: { 'better': '✨', 'worse': '⚠️', 'similar': '🔄', 'riskier': '🎲' }[verdict],
      wouldHaveChanged,
      summary,
      apyDelta: `${apyDelta >= 0 ? '+' : ''}${apyDelta.toFixed(2)}%`,
      riskDelta: `${riskDelta >= 0 ? '+' : ''}${riskDelta}`,
      actionDiff,
      insights,
    },
    alternativeOpportunities: alternatives,
  };
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(request: Request) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const url = new URL(request.url);
    const scenarioName = url.searchParams.get('scenario');

    if (scenarioName) {
      const scenario = PREDEFINED_SCENARIOS.find(s => s.name === scenarioName);
      if (!scenario) {
        return new Response(JSON.stringify({ error: `Unknown scenario: ${scenarioName}`, availableScenarios: PREDEFINED_SCENARIOS.map(s => s.name) }), { status: 400, headers });
      }
      const result = simulateScenario(scenario, DEFAULT_STRATEGY, DEMO_YIELDS);
      return new Response(JSON.stringify({ mode: 'demo', scenario: scenarioName, result }, null, 2), { headers });
    }

    // All scenarios
    const results = PREDEFINED_SCENARIOS.map(s => simulateScenario(s, DEFAULT_STRATEGY, DEMO_YIELDS));
    const learnings: string[] = [];
    
    const aggressive = results.find(r => r.scenario.name === 'aggressive');
    if (aggressive && aggressive.comparison.verdict === 'better') learnings.push('📊 Aggressive strategy would have outperformed.');
    
    const conservative = results.find(r => r.scenario.name === 'conservative');
    if (conservative && !conservative.comparison.wouldHaveChanged) learnings.push('🛡️ Conservative settings validated.');
    
    const unchangedCount = results.filter(r => !r.comparison.wouldHaveChanged).length;
    if (unchangedCount >= results.length * 0.7) learnings.push('✅ High conviction: Decision was robust across scenarios.');

    const betterResults = results.filter(r => r.comparison.verdict === 'better');
    const recommendation = betterResults.length > 0
      ? `Consider: "${betterResults[0].scenario.description}" would achieve ${betterResults[0].comparison.apyDelta} APY.`
      : 'Your strategy is performing optimally for current market conditions.';

    return new Response(JSON.stringify({
      mode: 'demo',
      description: 'What-if analysis across multiple strategy variations',
      originalContext: { timestamp: Date.now(), strategy: DEFAULT_STRATEGY },
      scenarios: results,
      learnings,
      recommendation,
    }, null, 2), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), { status: 500, headers });
  }
}
