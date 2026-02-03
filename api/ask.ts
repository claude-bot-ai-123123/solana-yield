/**
 * Natural Language Yield Query API
 * 
 * ChatGPT-style interface for querying DeFi yields.
 * Agent parses intent, fetches data, shows reasoning, returns recommendations.
 * 
 * POST /api/ask
 * Body: { "query": "What's the best low-risk stablecoin yield?" }
 * 
 * Returns structured response with:
 * - Parsed intent
 * - Reasoning chain
 * - Recommendations
 * - Action suggestions
 */

export const config = {
  runtime: 'edge',
};

// ============================================================================
// Types
// ============================================================================

interface QueryIntent {
  type: 'yield_search' | 'comparison' | 'risk_assessment' | 'strategy' | 'explanation' | 'general';
  riskTolerance?: 'low' | 'medium' | 'high';
  assets?: string[];
  protocols?: string[];
  minApy?: number;
  maxApy?: number;
  timeframe?: string;
  amount?: number;
}

interface YieldOpp {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  pool?: string;
  isStablecoin?: boolean;
  isLST?: boolean;
}

interface Recommendation {
  protocol: string;
  asset: string;
  apy: number;
  risk: string;
  reasoning: string;
  allocation?: number;
}

interface AskResponse {
  query: string;
  intent: QueryIntent;
  thinking: string[];
  answer: string;
  recommendations: Recommendation[];
  followUp: string[];
  data: {
    yieldsAnalyzed: number;
    topOpportunities: YieldOpp[];
  };
  timestamp: string;
}

// ============================================================================
// Intent Parser
// ============================================================================

function parseIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  
  // Detect risk tolerance
  let riskTolerance: 'low' | 'medium' | 'high' | undefined;
  if (q.includes('safe') || q.includes('low risk') || q.includes('conservative') || q.includes('stable')) {
    riskTolerance = 'low';
  } else if (q.includes('aggressive') || q.includes('high risk') || q.includes('degen') || q.includes('max yield')) {
    riskTolerance = 'high';
  } else if (q.includes('medium') || q.includes('balanced') || q.includes('moderate')) {
    riskTolerance = 'medium';
  }
  
  // Detect assets
  const assets: string[] = [];
  const assetPatterns = ['usdc', 'usdt', 'sol', 'msol', 'jitosol', 'bsol', 'eth', 'btc', 'stablecoin', 'lst'];
  for (const asset of assetPatterns) {
    if (q.includes(asset)) assets.push(asset);
  }
  
  // Detect protocols
  const protocols: string[] = [];
  const protocolPatterns = ['kamino', 'drift', 'jito', 'marinade', 'orca', 'raydium', 'marginfi', 'solend', 'lulo'];
  for (const proto of protocolPatterns) {
    if (q.includes(proto)) protocols.push(proto);
  }
  
  // Detect amount
  const amountMatch = q.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:dollars?|usd|usdc|sol)?/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : undefined;
  
  // Detect APY thresholds
  const apyMatch = q.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:apy|yield|return)/i);
  const minApy = apyMatch ? parseFloat(apyMatch[1]) : undefined;
  
  // Determine query type
  let type: QueryIntent['type'] = 'yield_search';
  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('better')) {
    type = 'comparison';
  } else if (q.includes('risk') || q.includes('safe') || q.includes('danger')) {
    type = 'risk_assessment';
  } else if (q.includes('strategy') || q.includes('allocat') || q.includes('portfolio') || q.includes('invest')) {
    type = 'strategy';
  } else if (q.includes('how') || q.includes('why') || q.includes('explain') || q.includes('what is')) {
    type = 'explanation';
  }
  
  return {
    type,
    riskTolerance,
    assets: assets.length > 0 ? assets : undefined,
    protocols: protocols.length > 0 ? protocols : undefined,
    minApy,
    amount,
  };
}

// ============================================================================
// Yield Fetcher
// ============================================================================

interface RawPool {
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  stablecoin: boolean;
  ilRisk: string;
  pool: string;
  chain: string;
}

async function fetchYields(): Promise<YieldOpp[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    return data.data
      .filter((p: RawPool) => p.chain === 'Solana' && p.tvlUsd > 100000 && p.apy > 0)
      .map((p: RawPool) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: Math.round(p.apy * 100) / 100,
        tvl: Math.round(p.tvlUsd),
        risk: assessRisk(p),
        pool: p.pool,
        isStablecoin: p.stablecoin || isStablecoinAsset(p.symbol),
        isLST: isLSTAsset(p.symbol),
      }))
      .sort((a: YieldOpp, b: YieldOpp) => b.apy - a.apy)
      .slice(0, 100);
  } catch (err) {
    console.error('Failed to fetch yields:', err);
    return [];
  }
}

// Check if asset name contains stablecoin indicators
function isStablecoinAsset(symbol: string): boolean {
  const s = symbol.toUpperCase();
  const stablePatterns = ['USDC', 'USDT', 'USDH', 'DAI', 'USDY', 'PYUSD', 'USD1', 'EURC', 'BUSD', 'TUSD', 'FRAX'];
  return stablePatterns.some(p => s.includes(p));
}

// Check if asset is a Liquid Staking Token
function isLSTAsset(symbol: string): boolean {
  const s = symbol.toUpperCase();
  const lstPatterns = ['MSOL', 'JITOSOL', 'BSOL', 'BONKSOL', 'LSOL', 'HSOL', 'JSOL', 'STSOL', 'SCNSOL'];
  // Also check for SOL but not in pairs like WSOL-X
  return lstPatterns.some(p => s.includes(p)) || (s === 'MSOL' || s === 'JITOSOL');
}

function assessRisk(pool: RawPool): 'low' | 'medium' | 'high' {
  // Stablecoin pools are generally lower risk
  if (pool.stablecoin || isStablecoinAsset(pool.symbol)) {
    // But very high APY stablecoin pools are suspicious
    if (pool.apy > 30) return 'medium';
    return 'low';
  }
  // IL risk is a concern
  if (pool.ilRisk === 'yes') return 'high';
  // Very high APY = likely high risk
  if (pool.apy > 50) return 'high';
  if (pool.apy > 20) return 'medium';
  return 'medium';
}

// ============================================================================
// AI Response Generator
// ============================================================================

async function generateResponse(
  query: string,
  intent: QueryIntent,
  yields: YieldOpp[]
): Promise<{ thinking: string[]; answer: string; recommendations: Recommendation[]; followUp: string[] }> {
  
  // Filter yields based on intent
  let filteredYields = [...yields];
  let appliedFilters: string[] = [];
  
  // First filter by assets (if specified)
  if (intent.assets && intent.assets.length > 0) {
    const assetSearch = intent.assets.map(a => a.toLowerCase());
    const assetFiltered = filteredYields.filter(y => 
      assetSearch.some(a => {
        const assetLower = y.asset.toLowerCase();
        if (assetLower.includes(a)) return true;
        if (a === 'stablecoin' || a === 'stable') return y.isStablecoin;
        if (a === 'lst') return y.isLST;
        if (a === 'sol') return assetLower.includes('sol') || y.isLST;
        return false;
      })
    );
    if (assetFiltered.length > 0) {
      filteredYields = assetFiltered;
      appliedFilters.push('assets');
    }
  }
  
  // Then filter by protocols (if specified)  
  if (intent.protocols && intent.protocols.length > 0) {
    const protoFiltered = filteredYields.filter(y =>
      intent.protocols!.some(p => y.protocol.toLowerCase().includes(p))
    );
    if (protoFiltered.length > 0) {
      filteredYields = protoFiltered;
      appliedFilters.push('protocols');
    }
  }
  
  // Then filter by min APY (if specified)
  if (intent.minApy) {
    const apyFiltered = filteredYields.filter(y => y.apy >= intent.minApy!);
    if (apyFiltered.length > 0) {
      filteredYields = apyFiltered;
      appliedFilters.push('minApy');
    }
  }
  
  // Finally filter by risk - but keep track of both filtered and unfiltered
  let riskFiltered: YieldOpp[] = filteredYields;
  if (intent.riskTolerance) {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const maxRisk = riskLevels[intent.riskTolerance];
    riskFiltered = filteredYields.filter(y => riskLevels[y.risk] <= maxRisk);
    
    // If risk filter removes everything, still use it but note it
    if (riskFiltered.length === 0 && filteredYields.length > 0) {
      // Keep the non-risk-filtered results but note the mismatch
      appliedFilters.push('risk-relaxed');
    } else if (riskFiltered.length > 0) {
      filteredYields = riskFiltered;
      appliedFilters.push('risk');
    }
  }
  
  const topYields = filteredYields.slice(0, 10);
  
  // Generate thinking chain
  const thinking: string[] = [];
  
  thinking.push(`📝 Parsed query: "${query}"`);
  thinking.push(`🎯 Intent type: ${intent.type}`);
  
  if (intent.riskTolerance) {
    thinking.push(`⚖️ Risk tolerance: ${intent.riskTolerance}`);
  }
  if (intent.assets?.length) {
    thinking.push(`💰 Target assets: ${intent.assets.join(', ')}`);
  }
  if (intent.protocols?.length) {
    thinking.push(`🏛️ Target protocols: ${intent.protocols.join(', ')}`);
  }
  
  thinking.push(`📊 Analyzing ${yields.length} Solana yield opportunities...`);
  thinking.push(`🔍 Filtered to ${filteredYields.length} matching opportunities`);
  
  if (appliedFilters.includes('risk-relaxed')) {
    thinking.push(`⚠️ No exact matches for ${intent.riskTolerance} risk - showing closest options`);
  }
  
  // Generate recommendations
  const recommendations: Recommendation[] = topYields.slice(0, 5).map((y, i) => ({
    protocol: y.protocol,
    asset: y.asset,
    apy: y.apy,
    risk: y.risk,
    reasoning: generateReasoningForYield(y, intent, i + 1),
    allocation: intent.type === 'strategy' ? calculateAllocation(y, topYields.slice(0, 5), i) : undefined,
  }));
  
  // Generate answer
  const answer = generateAnswer(query, intent, recommendations, filteredYields.length);
  
  // Generate follow-up suggestions
  const followUp = generateFollowUps(intent, recommendations);
  
  return { thinking, answer, recommendations, followUp };
}

function generateReasoningForYield(yield_: YieldOpp, intent: QueryIntent, rank: number): string {
  const reasons: string[] = [];
  
  if (rank === 1) {
    reasons.push(`Top yield at ${yield_.apy}% APY`);
  }
  
  if (yield_.risk === 'low') {
    reasons.push('Lower risk profile (stablecoin or established protocol)');
  } else if (yield_.risk === 'high') {
    reasons.push('Higher risk but potentially higher rewards');
  }
  
  if (yield_.tvl > 10_000_000) {
    reasons.push(`High liquidity ($${(yield_.tvl / 1_000_000).toFixed(1)}M TVL)`);
  } else if (yield_.tvl > 1_000_000) {
    reasons.push(`Good liquidity ($${(yield_.tvl / 1_000_000).toFixed(1)}M TVL)`);
  }
  
  const knownProtocols = ['kamino', 'drift', 'jito', 'marinade'];
  if (knownProtocols.some(p => yield_.protocol.toLowerCase().includes(p))) {
    reasons.push('Well-established Solana DeFi protocol');
  }
  
  return reasons.join('. ') + '.';
}

function calculateAllocation(yield_: YieldOpp, topYields: YieldOpp[], index: number): number {
  // Risk-weighted allocation
  const riskWeights = { low: 1.5, medium: 1.0, high: 0.5 };
  const weights = topYields.map(y => y.apy * riskWeights[y.risk]);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return Math.round((weights[index] / totalWeight) * 100);
}

function generateAnswer(
  query: string,
  intent: QueryIntent,
  recommendations: Recommendation[],
  totalMatches: number
): string {
  if (recommendations.length === 0) {
    return `I couldn't find any yield opportunities matching your criteria. Try broadening your search — for example, consider looking at different assets or adjusting your risk tolerance.`;
  }
  
  const top = recommendations[0];
  
  switch (intent.type) {
    case 'yield_search':
      return `Based on my analysis of ${totalMatches} matching opportunities, I recommend **${top.protocol}** with **${top.asset}** at **${top.apy}% APY**. This ${top.risk}-risk option offers a strong balance of yield and safety. ${recommendations.length > 1 ? `I've also identified ${recommendations.length - 1} other solid options below.` : ''}`;
    
    case 'comparison':
      if (recommendations.length >= 2) {
        const second = recommendations[1];
        return `Comparing options: **${top.protocol}** (${top.apy}% APY, ${top.risk} risk) vs **${second.protocol}** (${second.apy}% APY, ${second.risk} risk). ${top.apy > second.apy ? `${top.protocol} offers ${(top.apy - second.apy).toFixed(1)}% higher yield` : `${second.protocol} offers ${(second.apy - top.apy).toFixed(1)}% higher yield`}. ${top.risk !== second.risk ? `Note the risk difference: ${top.risk} vs ${second.risk}.` : 'Both have similar risk profiles.'}`;
      }
      return `The best option I found is **${top.protocol}** with **${top.apy}% APY** (${top.risk} risk).`;
    
    case 'risk_assessment':
      const riskNote = intent.riskTolerance === 'low' && top.risk !== 'low' 
        ? `\n\n⚠️ Note: True low-risk stablecoin yields (single-asset lending) are scarce on Solana right now. The options shown are LP pools which carry some risk.`
        : '';
      return `For ${intent.riskTolerance || 'balanced'} risk tolerance, I found ${totalMatches} opportunities. The top pick is **${top.protocol}** at **${top.apy}% APY** with ${top.risk} risk. ${top.risk === 'low' ? 'This is a relatively safe option with established protocols.' : top.risk === 'high' ? '⚠️ Higher yields come with increased risk — monitor positions closely.' : 'This offers a balanced risk-reward profile.'}${riskNote}`;
    
    case 'strategy':
      const totalAlloc = recommendations.reduce((sum, r) => sum + (r.allocation || 0), 0);
      const weightedApy = recommendations.reduce((sum, r) => sum + (r.apy * (r.allocation || 0) / 100), 0);
      return `Here's a diversified strategy across ${recommendations.length} positions for a blended **${weightedApy.toFixed(1)}% APY**:\n\n${recommendations.map(r => `• **${r.allocation}%** → ${r.protocol} (${r.asset}): ${r.apy}% APY`).join('\n')}\n\nThis allocation is weighted by risk-adjusted returns.`;
    
    case 'explanation':
      return `${top.protocol} offers ${top.apy}% APY on ${top.asset}. ${top.reasoning} The current market has ${totalMatches} similar opportunities on Solana.`;
    
    default:
      return `I found ${totalMatches} opportunities matching your query. The best option is **${top.protocol}** offering **${top.apy}% APY** on ${top.asset} with ${top.risk} risk.`;
  }
}

function generateFollowUps(intent: QueryIntent, recommendations: Recommendation[]): string[] {
  const followUps: string[] = [];
  
  if (intent.riskTolerance !== 'high') {
    followUps.push('What about higher-yield opportunities if I increase my risk tolerance?');
  }
  if (intent.riskTolerance !== 'low') {
    followUps.push('Show me safer options with stablecoins');
  }
  if (!intent.protocols?.length) {
    followUps.push('Compare Kamino vs Drift yields');
  }
  if (intent.type !== 'strategy') {
    followUps.push('Build me a diversified portfolio strategy');
  }
  if (recommendations.length > 0) {
    followUps.push(`Why did you recommend ${recommendations[0].protocol}?`);
  }
  
  return followUps.slice(0, 4);
}

// ============================================================================
// Request Handler
// ============================================================================

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed. Use POST with { "query": "your question" }',
      example: {
        query: "What's the best low-risk stablecoin yield on Solana?",
      },
    }), { status: 405, headers });
  }

  try {
    const body = await request.json();
    const query = body.query?.trim();

    if (!query) {
      return new Response(JSON.stringify({
        error: 'Missing query parameter',
        example: { query: "What's the best yield for USDC?" },
      }), { status: 400, headers });
    }

    // Parse intent
    const intent = parseIntent(query);

    // Fetch yields
    const yields = await fetchYields();

    // Generate response
    const { thinking, answer, recommendations, followUp } = await generateResponse(
      query,
      intent,
      yields
    );

    const response: AskResponse = {
      query,
      intent,
      thinking,
      answer,
      recommendations,
      followUp,
      data: {
        yieldsAnalyzed: yields.length,
        topOpportunities: yields.slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response, null, 2), { headers });

  } catch (err) {
    console.error('Ask API error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to process query',
      details: err instanceof Error ? err.message : 'Unknown error',
    }), { status: 500, headers });
  }
}
