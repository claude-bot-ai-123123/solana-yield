/**
 * Risk-Adjusted Yield Analysis API (Edge Runtime)
 * 
 * GET /api/risk?action=analyze&risk=medium&top=10
 * GET /api/risk?action=compare&top=5
 * GET /api/risk?action=protocols
 */

export const config = {
  runtime: 'edge',
};

// Protocol risk profiles
const PROTOCOL_PROFILES: Record<string, {
  name: string;
  audited: boolean;
  auditFirms?: string[];
  launchDate: string;
  historicalIncidents: number;
  lastIncidentDate?: string;
  centralizationRisk: 'low' | 'medium' | 'high';
  insuranceFund?: boolean;
  baseRiskScore: number;
}> = {
  'kamino': {
    name: 'Kamino Finance',
    audited: true,
    auditFirms: ['OtterSec', 'Halborn'],
    launchDate: '2022-06-01',
    historicalIncidents: 0,
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 25,
  },
  'drift': {
    name: 'Drift Protocol',
    audited: true,
    auditFirms: ['OtterSec', 'Trail of Bits'],
    launchDate: '2021-11-01',
    historicalIncidents: 1,
    lastIncidentDate: '2022-11-01',
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 30,
  },
  'jito': {
    name: 'Jito',
    audited: true,
    auditFirms: ['Neodyme', 'OtterSec'],
    launchDate: '2022-11-01',
    historicalIncidents: 0,
    centralizationRisk: 'medium',
    insuranceFund: false,
    baseRiskScore: 20,
  },
  'marinade': {
    name: 'Marinade Finance',
    audited: true,
    auditFirms: ['Neodyme', 'Kudelski'],
    launchDate: '2021-07-01',
    historicalIncidents: 0,
    centralizationRisk: 'low',
    insuranceFund: false,
    baseRiskScore: 15,
  },
  'mango': {
    name: 'Mango Markets',
    audited: true,
    auditFirms: ['OtterSec'],
    launchDate: '2021-08-01',
    historicalIncidents: 1,
    lastIncidentDate: '2022-10-01',
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 45,
  },
  'unknown': {
    name: 'Unknown Protocol',
    audited: false,
    launchDate: '2024-01-01',
    historicalIncidents: 0,
    centralizationRisk: 'high',
    baseRiskScore: 70,
  },
};

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  stablecoin?: boolean;
  apyBase?: number;
  apyReward?: number;
}

interface RiskScore {
  overall: number;
  factors: {
    smartContract: number;
    liquidity: number;
    sustainability: number;
    counterparty: number;
    assetVolatility: number;
  };
  warnings: string[];
  positives: string[];
}

interface AnalyzedYield extends YieldOpp {
  riskScore: RiskScore;
  adjustedApy: number;
  sharpeRatio: number;
  recommendation: 'strong' | 'moderate' | 'weak' | 'avoid';
}

const headers = { 
  'Content-Type': 'application/json', 
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'analyze';

  try {
    switch (action) {
      case 'analyze':
        return handleAnalyze(url);
      case 'compare':
        return handleCompare(url);
      case 'protocols':
        return handleProtocols();
      default:
        return new Response(JSON.stringify({ 
          error: `Unknown action: ${action}`,
          validActions: ['analyze', 'compare', 'protocols'],
        }), { status: 400, headers });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
}

async function fetchYields(): Promise<YieldOpp[]> {
  const response = await fetch('https://yields.llama.fi/pools');
  const data = await response.json();
  
  return data.data
    .filter((p: any) => p.chain === 'Solana' && p.tvlUsd >= 100000 && p.apy > 0)
    .map((p: any) => ({
      protocol: normalizeProtocol(p.project),
      asset: p.symbol,
      apy: p.apy,
      tvl: p.tvlUsd,
      stablecoin: p.stablecoin,
      apyBase: p.apyBase,
      apyReward: p.apyReward,
    }));
}

function normalizeProtocol(project: string): string {
  const lower = project.toLowerCase();
  if (lower.includes('kamino')) return 'kamino';
  if (lower.includes('drift')) return 'drift';
  if (lower.includes('jito')) return 'jito';
  if (lower.includes('marinade')) return 'marinade';
  if (lower.includes('mango')) return 'mango';
  return project;
}

function calculateRiskScore(opp: YieldOpp): RiskScore {
  const profile = PROTOCOL_PROFILES[opp.protocol] || PROTOCOL_PROFILES['unknown'];
  const warnings: string[] = [];
  const positives: string[] = [];
  
  // Smart Contract Risk (0-100)
  let smartContract = profile.baseRiskScore;
  
  if (!profile.audited) {
    smartContract += 30;
    warnings.push('Protocol not audited');
  } else {
    positives.push(`Audited by ${profile.auditFirms?.join(', ')}`);
  }
  
  if (profile.historicalIncidents > 0 && profile.lastIncidentDate) {
    const daysSinceIncident = Math.floor(
      (Date.now() - new Date(profile.lastIncidentDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceIncident < 365) {
      smartContract += 20;
      warnings.push('Security incident within past year');
    } else if (daysSinceIncident > 730) {
      positives.push('No incidents in 2+ years');
    }
  }
  
  const protocolAgeDays = Math.floor(
    (Date.now() - new Date(profile.launchDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (protocolAgeDays < 180) {
    smartContract += 25;
    warnings.push('Protocol less than 6 months old');
  } else if (protocolAgeDays > 730) {
    smartContract -= 10;
    positives.push('Battle-tested (2+ years)');
  }
  
  smartContract = Math.max(0, Math.min(100, smartContract));
  
  // Liquidity Risk (0-100)
  let liquidity = 0;
  if (opp.tvl < 100_000) {
    liquidity = 90;
    warnings.push(`Very low TVL ($${formatNumber(opp.tvl)})`);
  } else if (opp.tvl < 1_000_000) {
    liquidity = 60;
    warnings.push(`Low TVL ($${formatNumber(opp.tvl)})`);
  } else if (opp.tvl < 10_000_000) {
    liquidity = 40;
  } else if (opp.tvl < 100_000_000) {
    liquidity = 20;
    positives.push(`Strong TVL ($${formatNumber(opp.tvl)})`);
  } else {
    liquidity = 10;
    positives.push(`Excellent TVL ($${formatNumber(opp.tvl)})`);
  }
  
  // APY Sustainability Risk (0-100)
  let sustainability = 0;
  if (opp.apy > 100) {
    sustainability = 90;
    warnings.push(`Extremely high APY (${opp.apy.toFixed(1)}%) likely unsustainable`);
  } else if (opp.apy > 50) {
    sustainability = 70;
    warnings.push('Very high APY may not be sustainable');
  } else if (opp.apy > 25) {
    sustainability = 40;
  } else if (opp.apy > 10) {
    sustainability = 20;
    positives.push('APY in sustainable range');
  } else {
    sustainability = 10;
    positives.push('Conservative, sustainable APY');
  }
  
  if (opp.apyReward && opp.apyBase) {
    const rewardRatio = opp.apyReward / (opp.apyBase + opp.apyReward);
    if (rewardRatio > 0.8) {
      sustainability += 20;
      warnings.push('APY heavily dependent on token rewards');
    }
  }
  
  sustainability = Math.max(0, Math.min(100, sustainability));
  
  // Counterparty Risk (0-100)
  let counterparty = profile.centralizationRisk === 'high' ? 60 : 
                     profile.centralizationRisk === 'medium' ? 35 : 15;
  
  if (profile.centralizationRisk === 'low') {
    positives.push('Decentralized governance');
  }
  if (profile.insuranceFund) {
    positives.push('Insurance fund available');
  } else {
    counterparty += 10;
  }
  
  counterparty = Math.max(0, Math.min(100, counterparty));
  
  // Asset Volatility Risk (0-100)
  let assetVolatility = 30;
  const isStablecoin = opp.stablecoin || 
    ['usd', 'usdc', 'usdt', 'dai', 'pyusd', 'usdy'].some(s => opp.asset.toLowerCase().includes(s));
  
  if (isStablecoin) {
    assetVolatility = 10;
    positives.push('Stablecoin - low volatility');
  } else if (opp.asset.toLowerCase().includes('sol')) {
    assetVolatility = 40;
  } else if (opp.asset.toLowerCase().includes('btc') || opp.asset.toLowerCase().includes('eth')) {
    assetVolatility = 35;
  } else {
    assetVolatility = 65;
    warnings.push('Volatile asset');
  }
  
  // Weighted overall
  const overall = Math.round(
    smartContract * 0.30 +
    liquidity * 0.20 +
    sustainability * 0.20 +
    counterparty * 0.15 +
    assetVolatility * 0.15
  );
  
  return {
    overall,
    factors: { smartContract, liquidity, sustainability, counterparty, assetVolatility },
    warnings,
    positives,
  };
}

function calculateRiskAdjustedApy(apy: number, riskScore: number): number {
  const riskPenalty = riskScore / 200;
  return Math.max(0, apy * (1 - riskPenalty));
}

function calculateSharpeRatio(apy: number, riskScore: number): number {
  const riskFreeRate = 4;
  if (riskScore === 0) riskScore = 1;
  return (apy - riskFreeRate) / (riskScore / 10);
}

function getRecommendation(adjustedApy: number, riskScore: number, sharpeRatio: number): 'strong' | 'moderate' | 'weak' | 'avoid' {
  if (riskScore > 70) return 'avoid';
  if (riskScore > 55) return 'weak';
  if (sharpeRatio > 3 && adjustedApy > 8 && riskScore < 35) return 'strong';
  if (sharpeRatio > 2 && adjustedApy > 5) return 'moderate';
  return 'weak';
}

function analyzeYields(yields: YieldOpp[]): AnalyzedYield[] {
  return yields.map(opp => {
    const riskScore = calculateRiskScore(opp);
    const adjustedApy = calculateRiskAdjustedApy(opp.apy, riskScore.overall);
    const sharpeRatio = calculateSharpeRatio(opp.apy, riskScore.overall);
    const recommendation = getRecommendation(adjustedApy, riskScore.overall, sharpeRatio);
    
    return { ...opp, riskScore, adjustedApy, sharpeRatio, recommendation };
  });
}

function sortByRiskAdjusted(yields: AnalyzedYield[]): AnalyzedYield[] {
  return [...yields].sort((a, b) => {
    if (Math.abs(b.adjustedApy - a.adjustedApy) > 0.5) {
      return b.adjustedApy - a.adjustedApy;
    }
    return b.sharpeRatio - a.sharpeRatio;
  });
}

async function handleAnalyze(url: URL) {
  const riskLevel = url.searchParams.get('risk') || 'medium';
  const topN = parseInt(url.searchParams.get('top') || '10');
  const maxRisk = riskLevel === 'low' ? 35 : riskLevel === 'high' ? 75 : 55;

  const yields = await fetchYields();
  const analyzed = analyzeYields(yields);
  const filtered = analyzed.filter(o => o.riskScore.overall <= maxRisk);
  const sorted = sortByRiskAdjusted(filtered);
  const recommendations = sorted.slice(0, topN);

  return new Response(JSON.stringify({
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
    })),
  }), { headers });
}

async function handleCompare(url: URL) {
  const topN = parseInt(url.searchParams.get('top') || '5');

  const yields = await fetchYields();
  const analyzed = analyzeYields(yields);

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

  const byAdjusted = sortByRiskAdjusted(analyzed)
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

  return new Response(JSON.stringify({
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
  }), { headers });
}

async function handleProtocols() {
  return new Response(JSON.stringify({
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
  }), { headers });
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}
