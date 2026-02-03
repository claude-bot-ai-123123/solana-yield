/**
 * Risk-Adjusted Yield Analysis API
 * 
 * GET /api/risk?action=analyze&risk=medium&top=10
 * GET /api/risk?action=compare&top=5
 * GET /api/risk?action=protocols
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchAllSolanaYields } from '../src/lib/defillama';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn, 
  getTopRecommendations,
  PROTOCOL_PROFILES,
} from '../src/lib/risk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || 'analyze';

  try {
    switch (action) {
      case 'analyze':
        return handleAnalyze(req, res);
      case 'compare':
        return handleCompare(req, res);
      case 'protocols':
        return handleProtocols(req, res);
      default:
        return res.status(400).json({ 
          error: `Unknown action: ${action}`,
          validActions: ['analyze', 'compare', 'protocols'],
        });
    }
  } catch (err) {
    console.error('Risk API error:', err);
    return res.status(500).json({ error: String(err) });
  }
}

async function handleAnalyze(req: VercelRequest, res: VercelResponse) {
  const riskLevel = (req.query.risk as string) || 'medium';
  const topN = parseInt((req.query.top as string) || '10');

  const maxRisk = riskLevel === 'low' ? 35 : riskLevel === 'high' ? 75 : 55;

  const yields = await fetchAllSolanaYields();
  const recommendations = getTopRecommendations(yields, topN, maxRisk);

  return res.json({
    strategy: {
      riskTolerance: riskLevel,
      maxRiskScore: maxRisk,
      description: 'Recommendations sorted by risk-adjusted APY (not raw APY)',
    },
    count: recommendations.length,
    recommendations: recommendations.map(r => ({
      protocol: r.protocol,
      asset: r.asset,
      recommendation: r.recommendation,
      rawApy: parseFloat(r.apy.toFixed(2)),
      riskAdjustedApy: parseFloat(r.adjustedApy.toFixed(2)),
      riskScore: r.riskScore.overall,
      sharpeRatio: parseFloat(r.sharpeRatio.toFixed(2)),
      tvl: r.tvl,
      riskFactors: r.riskScore.factors,
      warnings: r.riskScore.warnings,
      positives: r.riskScore.positives,
      reasoning: r.reasoning,
    })),
  });
}

async function handleCompare(req: VercelRequest, res: VercelResponse) {
  const topN = parseInt((req.query.top as string) || '5');

  const yields = await fetchAllSolanaYields();
  const analyzed = analyzeOpportunities(yields);

  // Sort by raw APY (naive approach)
  const byRawApy = [...analyzed]
    .sort((a, b) => b.apy - a.apy)
    .slice(0, topN)
    .map(o => ({
      protocol: o.protocol,
      asset: o.asset,
      rawApy: parseFloat(o.apy.toFixed(2)),
      riskScore: o.riskScore.overall,
      warnings: o.riskScore.warnings,
    }));

  // Sort by risk-adjusted APY (smart approach)
  const byAdjusted = sortByRiskAdjustedReturn(analyzed)
    .slice(0, topN)
    .map(o => ({
      protocol: o.protocol,
      asset: o.asset,
      rawApy: parseFloat(o.apy.toFixed(2)),
      riskAdjustedApy: parseFloat(o.adjustedApy.toFixed(2)),
      sharpeRatio: parseFloat(o.sharpeRatio.toFixed(2)),
      riskScore: o.riskScore.overall,
      positives: o.riskScore.positives,
    }));

  return res.json({
    description: 'Compare naive (raw APY) vs smart (risk-adjusted) ranking',
    naive_ranking: {
      strategy: 'Sort by highest raw APY',
      results: byRawApy,
      warning: 'This approach ignores protocol risk, TVL, and APY sustainability',
    },
    smart_ranking: {
      strategy: 'Sort by risk-adjusted APY (like Sharpe ratio for DeFi)',
      results: byAdjusted,
      explanation: 'Penalizes APY based on smart contract risk, TVL, sustainability, and asset volatility',
    },
  });
}

async function handleProtocols(req: VercelRequest, res: VercelResponse) {
  return res.json({
    description: 'Protocol risk profiles used for scoring',
    profiles: PROTOCOL_PROFILES,
    scoring: {
      smartContract: 'Based on audit status, historical incidents, protocol age',
      liquidity: 'Based on TVL depth',
      sustainability: 'Based on APY level and reward dependency',
      counterparty: 'Based on centralization and insurance coverage',
      assetVolatility: 'Based on asset type (stablecoin vs volatile)',
    },
    weights: {
      smartContract: 0.30,
      liquidity: 0.20,
      sustainability: 0.20,
      counterparty: 0.15,
      assetVolatility: 0.15,
    },
  });
}
