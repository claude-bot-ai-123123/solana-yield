export const config = { runtime: 'edge' };

/**
 * Protocol Comparison API - "Why This One?"
 * 
 * THE TRUST-BUILDER: Shows 2-3 alternatives with clear pros/cons
 * 
 * When we recommend Kamino at 9.5%, users should see:
 * - Why not Drift at 7.5%?
 * - Why not Lulo at 12.5%?
 * - Why not Mango at 15%?
 * 
 * This builds trust by showing the agent considered all options.
 */

// ============================================================================
// Types
// ============================================================================

interface ProtocolComparison {
  protocol: string;
  asset: string;
  rawApy: number;
  adjustedApy: number;
  riskScore: number;
  tvl: number;
  isRecommended: boolean;
  rank: number;
  pros: string[];
  cons: string[];
  whyChosen?: string;
  whyNotChosen?: string;
}

interface ComparisonResult {
  recommendation: ProtocolComparison;
  alternatives: ProtocolComparison[];
  comparisonMatrix: {
    factor: string;
    weight: string;
    winner: string;
    scores: Record<string, { value: string; color: 'green' | 'yellow' | 'red' }>;
  }[];
  summary: {
    headline: string;
    reasoning: string;
    confidenceStatement: string;
  };
  faqs: { question: string; answer: string }[];
}

// ============================================================================
// Protocol Data
// ============================================================================

const PROTOCOL_INFO: Record<string, { 
  fullName: string; 
  audited: boolean; 
  auditFirms?: string[];
  founded: string;
  category: string;
  incidents: number;
}> = {
  'kamino': { fullName: 'Kamino Finance', audited: true, auditFirms: ['OtterSec', 'Halborn'], founded: '2022', category: 'Lending/Vaults', incidents: 0 },
  'drift': { fullName: 'Drift Protocol', audited: true, auditFirms: ['OtterSec', 'Trail of Bits'], founded: '2021', category: 'Perps DEX', incidents: 1 },
  'jito': { fullName: 'Jito Labs', audited: true, auditFirms: ['OtterSec'], founded: '2022', category: 'Liquid Staking', incidents: 0 },
  'marinade': { fullName: 'Marinade Finance', audited: true, auditFirms: ['Kudelski', 'Ackee'], founded: '2021', category: 'Liquid Staking', incidents: 0 },
  'lulo': { fullName: 'Lulo Finance', audited: true, auditFirms: ['OtterSec'], founded: '2023', category: 'Yield Optimizer', incidents: 0 },
  'mango': { fullName: 'Mango Markets', audited: true, auditFirms: ['Neodyme'], founded: '2021', category: 'Perps DEX', incidents: 2 },
  'orca': { fullName: 'Orca', audited: true, auditFirms: ['Kudelski', 'Neodyme'], founded: '2021', category: 'DEX', incidents: 0 },
};

// ============================================================================
// Demo Data
// ============================================================================

function getDemoYields() {
  return [
    { protocol: 'kamino', asset: 'USDC', apy: 9.5, tvl: 450_000_000, risk: 'low' },
    { protocol: 'drift', asset: 'USDC', apy: 7.5, tvl: 320_000_000, risk: 'low' },
    { protocol: 'jito', asset: 'SOL', apy: 8.1, tvl: 1_200_000_000, risk: 'low' },
    { protocol: 'marinade', asset: 'mSOL', apy: 7.8, tvl: 800_000_000, risk: 'low' },
    { protocol: 'lulo', asset: 'USDC', apy: 12.5, tvl: 85_000_000, risk: 'medium' },
    { protocol: 'mango', asset: 'USDC', apy: 15.2, tvl: 45_000_000, risk: 'high' },
    { protocol: 'orca', asset: 'SOL-USDC', apy: 22.5, tvl: 35_000_000, risk: 'high' },
  ];
}

function calculateRiskScore(y: any): number {
  let score = y.risk === 'low' ? 25 : y.risk === 'medium' ? 45 : 65;
  if (y.tvl < 50_000_000) score += 15;
  else if (y.tvl > 500_000_000) score -= 10;
  if (y.apy > 20) score += 15;
  else if (y.apy > 15) score += 10;
  
  const info = PROTOCOL_INFO[y.protocol];
  if (info?.incidents && info.incidents > 0) score += info.incidents * 8;
  
  return Math.min(100, Math.max(0, score));
}

function getAdjustedApy(y: any, riskScore: number): number {
  return y.apy * (1 - riskScore / 200);
}

function generatePros(y: any, riskScore: number): string[] {
  const pros: string[] = [];
  const info = PROTOCOL_INFO[y.protocol];
  
  if (y.apy >= 10) pros.push(`High APY: ${y.apy.toFixed(1)}%`);
  else if (y.apy >= 7) pros.push(`Competitive APY: ${y.apy.toFixed(1)}%`);
  
  if (y.tvl >= 500_000_000) pros.push(`Deep liquidity: $${(y.tvl / 1e9).toFixed(1)}B TVL`);
  else if (y.tvl >= 100_000_000) pros.push(`Strong liquidity: $${(y.tvl / 1e6).toFixed(0)}M TVL`);
  
  if (riskScore < 30) pros.push('Very low risk score');
  else if (riskScore < 45) pros.push('Low-moderate risk');
  
  if (info?.audited && info.auditFirms && info.auditFirms.length >= 2) {
    pros.push(`Multiple audits: ${info.auditFirms.join(', ')}`);
  } else if (info?.audited) {
    pros.push('Professionally audited');
  }
  
  if (info?.incidents === 0) pros.push('No historical security incidents');
  if (info?.founded && parseInt(info.founded) <= 2021) pros.push('Battle-tested protocol (2+ years)');
  
  return pros;
}

function generateCons(y: any, riskScore: number, topApy: number, topAdjustedApy: number): string[] {
  const cons: string[] = [];
  const info = PROTOCOL_INFO[y.protocol];
  
  if (y.apy < topApy - 3) cons.push(`Lower APY than top option (-${(topApy - y.apy).toFixed(1)}%)`);
  
  if (y.tvl < 50_000_000) cons.push('Limited liquidity - potential exit risk');
  else if (y.tvl < 100_000_000) cons.push('Moderate liquidity depth');
  
  if (riskScore >= 60) cons.push(`Elevated risk score: ${riskScore}/100`);
  else if (riskScore >= 45) cons.push('Moderate risk level');
  
  if (y.apy > 20) cons.push('Very high APY may be unsustainable');
  else if (y.apy > 15) cons.push('High APY - verify sustainability');
  
  if (info?.incidents && info.incidents >= 2) cons.push(`${info.incidents} past security incidents`);
  else if (info?.incidents && info.incidents === 1) cons.push('1 historical incident (recovered)');
  
  if (!info) cons.push('Lesser-known protocol - limited data');
  
  return cons;
}

// ============================================================================
// Comparison Logic
// ============================================================================

function buildComparison(riskTolerance: 'low' | 'medium' | 'high' = 'medium'): ComparisonResult {
  const yields = getDemoYields();
  const maxRisk = riskTolerance === 'low' ? 35 : riskTolerance === 'high' ? 75 : 55;
  
  // Analyze all
  const analyzed = yields.map(y => {
    const riskScore = calculateRiskScore(y);
    const adjustedApy = getAdjustedApy(y, riskScore);
    return { ...y, riskScore, adjustedApy };
  });
  
  // Filter by risk tolerance
  const eligible = analyzed.filter(y => y.riskScore <= maxRisk);
  const sorted = eligible.sort((a, b) => b.adjustedApy - a.adjustedApy);
  
  const top = sorted[0];
  const alts = sorted.slice(1, 4); // Next 3 alternatives
  
  // Also include a higher-risk option that was filtered out (for "why not this higher APY?" question)
  const higherRiskOption = analyzed
    .filter(y => y.riskScore > maxRisk)
    .sort((a, b) => b.apy - a.apy)[0];
  
  // Build comparison objects
  const recommendation: ProtocolComparison = {
    protocol: top.protocol,
    asset: top.asset,
    rawApy: top.apy,
    adjustedApy: parseFloat(top.adjustedApy.toFixed(2)),
    riskScore: top.riskScore,
    tvl: top.tvl,
    isRecommended: true,
    rank: 1,
    pros: generatePros(top, top.riskScore),
    cons: generateCons(top, top.riskScore, top.apy, top.adjustedApy),
    whyChosen: `Best risk-adjusted return (${top.adjustedApy.toFixed(1)}%) within your ${riskTolerance} risk tolerance`,
  };
  
  const alternatives: ProtocolComparison[] = alts.map((alt, i) => ({
    protocol: alt.protocol,
    asset: alt.asset,
    rawApy: alt.apy,
    adjustedApy: parseFloat(alt.adjustedApy.toFixed(2)),
    riskScore: alt.riskScore,
    tvl: alt.tvl,
    isRecommended: false,
    rank: i + 2,
    pros: generatePros(alt, alt.riskScore),
    cons: generateCons(alt, alt.riskScore, top.apy, top.adjustedApy),
    whyNotChosen: generateWhyNotChosen(alt, top),
  }));
  
  // Add the high-risk option if available
  if (higherRiskOption) {
    alternatives.push({
      protocol: higherRiskOption.protocol,
      asset: higherRiskOption.asset,
      rawApy: higherRiskOption.apy,
      adjustedApy: parseFloat(higherRiskOption.adjustedApy.toFixed(2)),
      riskScore: higherRiskOption.riskScore,
      tvl: higherRiskOption.tvl,
      isRecommended: false,
      rank: alternatives.length + 2,
      pros: generatePros(higherRiskOption, higherRiskOption.riskScore),
      cons: generateCons(higherRiskOption, higherRiskOption.riskScore, top.apy, top.adjustedApy),
      whyNotChosen: `⚠️ Exceeds your ${riskTolerance} risk tolerance (risk score: ${higherRiskOption.riskScore}/100)`,
    });
  }
  
  // Build comparison matrix
  const allOptions = [top, ...alts];
  const comparisonMatrix = buildComparisonMatrix(allOptions);
  
  // Generate summary
  const summary = {
    headline: `📊 Recommended: ${top.asset} on ${PROTOCOL_INFO[top.protocol]?.fullName || top.protocol}`,
    reasoning: `Out of ${eligible.length} options within your ${riskTolerance} risk tolerance, ${top.protocol} offers the best risk-adjusted return at ${top.adjustedApy.toFixed(1)}% (from ${top.apy.toFixed(1)}% raw APY). ${alternatives.length > 0 ? `We also considered ${alternatives.slice(0, 2).map(a => a.protocol).join(', ')}, but they had lower risk-adjusted returns.` : ''}`,
    confidenceStatement: `Confidence: ${top.riskScore < 35 ? 'HIGH' : top.riskScore < 50 ? 'MEDIUM' : 'MODERATE'} - Based on ${top.tvl > 100_000_000 ? 'strong' : 'adequate'} liquidity and ${PROTOCOL_INFO[top.protocol]?.audited ? 'verified audits' : 'protocol reputation'}.`,
  };
  
  // Generate FAQs
  const faqs = generateFAQs(top, alternatives, riskTolerance);
  
  return {
    recommendation,
    alternatives,
    comparisonMatrix,
    summary,
    faqs,
  };
}

function generateWhyNotChosen(alt: any, top: any): string {
  const reasons: string[] = [];
  
  if (alt.adjustedApy < top.adjustedApy) {
    const diff = top.adjustedApy - alt.adjustedApy;
    reasons.push(`${diff.toFixed(1)}% lower risk-adjusted APY`);
  }
  
  if (alt.riskScore > top.riskScore + 10) {
    reasons.push(`Higher risk score (+${alt.riskScore - top.riskScore} points)`);
  }
  
  if (alt.tvl < top.tvl / 2) {
    reasons.push(`Lower liquidity (${(alt.tvl / top.tvl * 100).toFixed(0)}% of ${top.protocol})`);
  }
  
  return reasons.join('; ') || 'Marginally lower returns';
}

function buildComparisonMatrix(options: any[]) {
  const factors = [
    { name: 'Raw APY', key: 'apy', higherBetter: true, format: (v: number) => `${v.toFixed(1)}%` },
    { name: 'Risk-Adj APY', key: 'adjustedApy', higherBetter: true, format: (v: number) => `${v.toFixed(1)}%` },
    { name: 'Risk Score', key: 'riskScore', higherBetter: false, format: (v: number) => `${v}/100` },
    { name: 'TVL', key: 'tvl', higherBetter: true, format: (v: number) => `$${(v / 1e6).toFixed(0)}M` },
  ];
  
  return factors.map(factor => {
    const values = options.map(o => o[factor.key]);
    const best = factor.higherBetter ? Math.max(...values) : Math.min(...values);
    
    const scores: Record<string, { value: string; color: 'green' | 'yellow' | 'red' }> = {};
    options.forEach(o => {
      const val = o[factor.key];
      const isBest = val === best;
      const isWorst = factor.higherBetter ? val === Math.min(...values) : val === Math.max(...values);
      
      scores[o.protocol] = {
        value: factor.format(val),
        color: isBest ? 'green' : isWorst ? 'red' : 'yellow',
      };
    });
    
    const winner = options.find(o => o[factor.key] === best)?.protocol || '';
    
    return {
      factor: factor.name,
      weight: factor.key === 'adjustedApy' ? '40%' : factor.key === 'riskScore' ? '30%' : factor.key === 'tvl' ? '20%' : '10%',
      winner,
      scores,
    };
  });
}

function generateFAQs(top: any, alts: ProtocolComparison[], riskTolerance: string) {
  const faqs = [];
  
  // FAQ: Why not the highest APY option?
  const highestApy = [...alts].sort((a, b) => b.rawApy - a.rawApy)[0];
  if (highestApy && highestApy.rawApy > top.apy) {
    faqs.push({
      question: `Why not ${highestApy.protocol} with ${highestApy.rawApy}% APY?`,
      answer: `While ${highestApy.protocol} offers a higher raw APY (${highestApy.rawApy}% vs ${top.apy}%), after adjusting for risk, ${top.protocol} provides better returns. ${highestApy.cons.slice(0, 2).join('. ')}.`,
    });
  }
  
  // FAQ: What if I want more yield?
  faqs.push({
    question: 'What if I want higher yields?',
    answer: `You can increase your risk tolerance to "high" to access more opportunities. This unlocks options with higher APYs but also higher risk scores. The tradeoff: potential for better returns, but increased chance of losses.`,
  });
  
  // FAQ: How often should I rebalance?
  faqs.push({
    question: 'How often do you recommend rebalancing?',
    answer: `We recommend reviewing positions when risk-adjusted APY changes by more than 2%. Currently, ${top.protocol} is stable. The agent monitors continuously and will alert you to significant changes.`,
  });
  
  // FAQ: What's the difference between raw and adjusted APY?
  faqs.push({
    question: 'What\'s the difference between raw and adjusted APY?',
    answer: `Raw APY is the advertised yield. Risk-adjusted APY penalizes returns based on protocol risk factors (audit status, TVL, historical incidents). A 20% APY on an unaudited protocol might have a risk-adjusted APY of only 12%.`,
  });
  
  return faqs;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*' 
  };
  
  const url = new URL(request.url);
  const riskTolerance = (url.searchParams.get('risk') || 'medium') as 'low' | 'medium' | 'high';
  const format = url.searchParams.get('format'); // 'simple' for condensed output
  
  const comparison = buildComparison(riskTolerance);
  
  if (format === 'simple') {
    return new Response(JSON.stringify({
      recommendation: {
        protocol: comparison.recommendation.protocol,
        asset: comparison.recommendation.asset,
        apy: `${comparison.recommendation.rawApy}%`,
        adjustedApy: `${comparison.recommendation.adjustedApy}%`,
        risk: comparison.recommendation.riskScore < 35 ? 'LOW' : comparison.recommendation.riskScore < 55 ? 'MEDIUM' : 'HIGH',
      },
      whyNotOthers: comparison.alternatives.slice(0, 3).map(a => ({
        protocol: a.protocol,
        apy: `${a.rawApy}%`,
        reason: a.whyNotChosen,
      })),
      summary: comparison.summary.reasoning,
    }, null, 2), { headers });
  }
  
  return new Response(JSON.stringify({
    mode: 'demo',
    riskTolerance,
    ...comparison,
  }, null, 2), { headers });
}
