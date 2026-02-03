export const config = { runtime: 'edge' };

interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

const DEMO_YIELDS: YieldOpportunity[] = [
  { protocol: 'kamino', asset: 'USDC', apy: 9.5, tvl: 450_000_000, risk: 'low' },
  { protocol: 'drift', asset: 'USDC', apy: 7.5, tvl: 320_000_000, risk: 'low' },
  { protocol: 'jito', asset: 'SOL', apy: 8.1, tvl: 1_200_000_000, risk: 'low' },
  { protocol: 'lulo', asset: 'USDC', apy: 12.5, tvl: 85_000_000, risk: 'medium' },
  { protocol: 'mango', asset: 'USDC', apy: 15.2, tvl: 45_000_000, risk: 'high' },
  { protocol: 'orca', asset: 'SOL-USDC', apy: 22.5, tvl: 35_000_000, risk: 'high' },
];

function getRiskMaxScore(tolerance: 'low' | 'medium' | 'high'): number {
  return tolerance === 'low' ? 35 : tolerance === 'high' ? 75 : 55;
}

function getOpportunityRiskScore(opp: YieldOpportunity): number {
  let base = opp.risk === 'low' ? 20 : opp.risk === 'medium' ? 45 : 70;
  if (opp.tvl < 50_000_000) base += 10;
  else if (opp.tvl > 500_000_000) base -= 5;
  if (opp.apy > 20) base += 10;
  return Math.min(100, Math.max(0, base));
}

function getAdjustedApy(opp: YieldOpportunity, riskScore: number): number {
  return opp.apy * (1 - riskScore / 100 * 0.5);
}

export default async function handler(request: Request) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  const url = new URL(request.url);
  const riskLevel = (url.searchParams.get('risk') || 'high') as 'low' | 'medium' | 'high';

  // Original: medium risk
  const originalMaxRisk = getRiskMaxScore('medium');
  const originalEligible = DEMO_YIELDS
    .map(y => ({ ...y, riskScore: getOpportunityRiskScore(y), adjustedApy: getAdjustedApy(y, getOpportunityRiskScore(y)) }))
    .filter(y => y.riskScore <= originalMaxRisk)
    .sort((a, b) => b.adjustedApy - a.adjustedApy);
  const originalTop = originalEligible[0];

  // Modified
  const modifiedMaxRisk = getRiskMaxScore(riskLevel);
  const modifiedEligible = DEMO_YIELDS
    .map(y => ({ ...y, riskScore: getOpportunityRiskScore(y), adjustedApy: getAdjustedApy(y, getOpportunityRiskScore(y)) }))
    .filter(y => y.riskScore <= modifiedMaxRisk)
    .sort((a, b) => b.adjustedApy - a.adjustedApy);
  const modifiedTop = modifiedEligible[0];

  const wouldHaveChanged = originalTop?.protocol !== modifiedTop?.protocol;
  const apyDelta = (modifiedTop?.adjustedApy || 0) - (originalTop?.adjustedApy || 0);
  const riskDelta = (modifiedTop?.riskScore || 0) - (originalTop?.riskScore || 0);

  let verdict: string;
  if (!wouldHaveChanged) verdict = 'similar';
  else if (apyDelta > 1 && riskDelta <= 5) verdict = 'better';
  else if (apyDelta > 1 && riskDelta > 10) verdict = 'riskier';
  else verdict = 'similar';

  const insights: string[] = [];
  if (riskLevel === 'high' && riskDelta > 10) insights.push(`⚠️ Higher risk tolerance exposes you to ${riskDelta} points more risk`);
  if (riskLevel === 'low' && riskDelta < -10) insights.push(`🛡️ Lower risk tolerance reduces risk by ${Math.abs(riskDelta)} points`);
  if (apyDelta > 2) insights.push(`📈 This strategy yields ${apyDelta.toFixed(1)}% more APY`);

  return new Response(JSON.stringify({
    mode: 'demo',
    question: `What if risk tolerance was ${riskLevel}?`,
    answer: {
      wouldHaveChanged,
      verdict,
      verdictEmoji: { 'better': '✨', 'worse': '⚠️', 'similar': '🔄', 'riskier': '🎲' }[verdict] || '🔄',
      summary: wouldHaveChanged
        ? `Would have chosen ${modifiedTop?.asset} on ${modifiedTop?.protocol}. APY ${apyDelta >= 0 ? '+' : ''}${apyDelta.toFixed(1)}%, Risk ${riskDelta >= 0 ? '+' : ''}${riskDelta} points.`
        : 'Same decision with these parameters.',
      apyDelta: `${apyDelta >= 0 ? '+' : ''}${apyDelta.toFixed(1)}%`,
      riskDelta: `${riskDelta >= 0 ? '+' : ''}${riskDelta} points`,
      insights,
    },
    newTopChoice: modifiedTop ? `${modifiedTop.asset} on ${modifiedTop.protocol}` : null,
    alternativeOpportunities: modifiedEligible.slice(0, 3).map(o => ({
      protocol: o.protocol,
      asset: o.asset,
      rawApy: o.apy,
      adjustedApy: parseFloat(o.adjustedApy.toFixed(2)),
      riskScore: o.riskScore,
    })),
  }, null, 2), { headers });
}
