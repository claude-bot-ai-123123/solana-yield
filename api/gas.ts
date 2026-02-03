/**
 * Gas Optimization AI API
 * 
 * GET /api/gas - Full analysis (default)
 * GET /api/gas?action=network - Network congestion
 * GET /api/gas?action=tiers - All tier costs
 * GET /api/gas?action=recommend - Quick recommendation
 * GET /api/gas?action=timing - Timing recommendations
 * GET /api/gas?action=estimate&type=swap - Estimate for action
 * POST /api/gas?action=batch - Batch optimization
 */

export const config = {
  runtime: 'edge',
};

const PRIORITY_TIERS = {
  economy: { name: 'Economy', multiplier: 0.5, description: 'Lowest cost, may be delayed' },
  standard: { name: 'Standard', multiplier: 1.0, description: 'Balanced cost and speed' },
  fast: { name: 'Fast', multiplier: 2.0, description: 'Priority processing' },
  urgent: { name: 'Urgent', multiplier: 5.0, description: 'Maximum priority' },
} as const;

type PriorityTier = keyof typeof PRIORITY_TIERS;

interface NetworkCongestion {
  level: 'low' | 'medium' | 'high' | 'extreme';
  score: number;
  recentPriorityFees: { min: number; median: number; p75: number; p90: number; max: number };
  timestamp: number;
}

const HISTORICAL_CONGESTION: Record<number, number> = {
  0: 25, 1: 20, 2: 15, 3: 12, 4: 10, 5: 12, 6: 18, 7: 25, 8: 35, 9: 45, 10: 55, 11: 60,
  12: 65, 13: 70, 14: 75, 15: 80, 16: 85, 17: 80, 18: 70, 19: 60, 20: 50, 21: 40, 22: 35, 23: 30,
};
const DAY_MULT: Record<number, number> = { 0: 0.7, 1: 1.0, 2: 1.1, 3: 1.1, 4: 1.2, 5: 1.0, 6: 0.8 };
const ACTION_CU: Record<string, number> = {
  swap: 300000, deposit: 200000, withdraw: 200000, stake: 150000, unstake: 150000, claim: 100000, transfer: 50000,
};

const RPC = 'https://api.mainnet-beta.solana.com';
let solPrice = 180;

async function updateSolPrice(): Promise<void> {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const d = await r.json() as { solana?: { usd?: number } };
    if (d?.solana?.usd) solPrice = d.solana.usd;
  } catch { /* ignore */ }
}

async function getNetwork(): Promise<NetworkCongestion> {
  const now = Date.now();
  const defaultFees = { min: 100, median: 1000, p75: 2500, p90: 5000, max: 50000 };
  
  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentPrioritizationFees', params: [] }),
    });
    
    if (!r.ok) throw new Error('RPC error');
    
    const d = await r.json() as { result?: Array<{ prioritizationFee: number }> };
    const fees = (d?.result || [])
      .map(f => f.prioritizationFee)
      .filter(f => typeof f === 'number' && f > 0)
      .sort((a, b) => a - b);

    const pct = (arr: number[], p: number) => arr.length > 0 ? arr[Math.max(0, Math.ceil(arr.length * p) - 1)] : 0;
    
    const recentPriorityFees = fees.length > 0 ? {
      min: fees[0],
      median: pct(fees, 0.5),
      p75: pct(fees, 0.75),
      p90: pct(fees, 0.9),
      max: fees[fees.length - 1],
    } : defaultFees;

    const score = Math.round(Math.min(100, (recentPriorityFees.median / 10000) * 50) + 25);
    const level = score < 25 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'extreme';
    
    return { level, score, recentPriorityFees, timestamp: now };
  } catch {
    return { level: 'medium', score: 45, recentPriorityFees: defaultFees, timestamp: now };
  }
}

function getRecommendation(net: NetworkCongestion, cu: number, pref?: PriorityTier) {
  const tier: PriorityTier = pref || (net.level === 'extreme' ? 'fast' : net.level === 'high' ? 'standard' : 'economy');
  const priorityFee = Math.round(net.recentPriorityFees.median * PRIORITY_TIERS[tier].multiplier);
  const lamports = 5000 + Math.round((priorityFee * cu) / 1_000_000);
  const sol = lamports / 1e9;

  const tierTime: Record<PriorityTier, number> = {
    economy: net.level === 'extreme' ? 30 : net.level === 'high' ? 10 : 3,
    standard: net.level === 'extreme' ? 10 : 4,
    fast: net.level === 'extreme' ? 4 : 2,
    urgent: 1
  };
  const secs = 0.8 * tierTime[tier];
  let conf = 80 - (net.level === 'extreme' ? 20 : net.level === 'high' ? 10 : 0) - (tier === 'economy' && net.level !== 'low' ? 10 : 0);

  return {
    tier,
    priorityFee,
    estimatedCost: { lamports, sol: Number(sol.toFixed(9)), usd: Number((sol * solPrice).toFixed(6)) },
    estimatedTime: secs < 1 ? '<1s' : secs < 60 ? `~${Math.round(secs)}s` : `~${Math.round(secs / 60)}m`,
    confidence: Math.max(50, Math.min(100, conf)),
    reasoning: [`Network: ${net.level} (${net.score}/100)`, `Tier: ${PRIORITY_TIERS[tier].name}`, `Fee: ${priorityFee} µlamp/CU`],
  };
}

function getTiming(net: NetworkCongestion, cu: number) {
  const hr = new Date().getUTCHours();
  const day = new Date().getUTCDay();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const times: Array<{ hour: number; day: string; level: string; savings: number }> = [];
  
  for (let o = 0; o < 24; o++) {
    const h = (hr + o) % 24;
    const d = (day + Math.floor((hr + o) / 24)) % 7;
    const hs = HISTORICAL_CONGESTION[h] * DAY_MULT[d];
    if (hs < net.score * 0.7) {
      times.push({
        hour: h,
        day: days[d],
        level: hs < 25 ? 'low' : hs < 50 ? 'med' : 'high',
        savings: Number(((net.score - hs) / net.score * 100).toFixed(1))
      });
    }
  }
  times.sort((a, b) => b.savings - a.savings);

  const curr = getRecommendation(net, cu);
  const optNet: NetworkCongestion = { ...net, score: 10, level: 'low' };
  const opt = getRecommendation(optNet, cu);

  return {
    bestTimes: times.slice(0, 5),
    savings: {
      current: curr.estimatedCost.lamports,
      optimal: opt.estimatedCost.lamports,
      pct: Number(((1 - opt.estimatedCost.lamports / curr.estimatedCost.lamports) * 100).toFixed(1))
    }
  };
}

function getInsights(net: NetworkCongestion, rec: ReturnType<typeof getRecommendation>): string[] {
  const i: string[] = [];
  if (net.level === 'extreme') i.push('🚨 Extreme congestion - delay if possible');
  else if (net.level === 'high') i.push('⚠️ High activity - Fast tier recommended');
  else if (net.level === 'low') i.push('✅ Quiet network - great for batch ops');
  if (rec.estimatedCost.usd < 0.01) i.push('💰 Under $0.01 - Solana efficiency!');
  if (net.recentPriorityFees.p90 > 10000) i.push('💸 High competition for block space');
  return i;
}

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    await updateSolPrice();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'analyze';
    const cu = parseInt(url.searchParams.get('cu') || '200000') || 200000;

    const net = await getNetwork();

    if (action === 'network') {
      return new Response(JSON.stringify({
        success: true,
        network: { ...net, timestamp: new Date(net.timestamp).toISOString() },
        description: { low: 'Quiet - Economy OK', medium: 'Normal - Standard OK', high: 'Busy - use Fast', extreme: 'Very busy - Urgent needed' }[net.level]
      }), { headers });
    }

    if (action === 'tiers') {
      const tierKeys: PriorityTier[] = ['economy', 'standard', 'fast', 'urgent'];
      const tiers = tierKeys.map(t => {
        const rec = getRecommendation(net, cu, t);
        return { tierKey: t, tierName: PRIORITY_TIERS[t].name, description: PRIORITY_TIERS[t].description, ...rec };
      });
      return new Response(JSON.stringify({ success: true, computeUnits: cu, network: { level: net.level, score: net.score }, tiers }), { headers });
    }

    if (action === 'recommend') {
      const pref = url.searchParams.get('tier') as PriorityTier | null;
      const rec = getRecommendation(net, cu, pref || undefined);
      return new Response(JSON.stringify({ success: true, computeUnits: cu, network: { level: net.level, score: net.score }, recommendation: rec }), { headers });
    }

    if (action === 'timing') {
      const timing = getTiming(net, cu);
      return new Response(JSON.stringify({ success: true, computeUnits: cu, currentTime: new Date().toISOString(), network: { level: net.level, score: net.score }, timing }), { headers });
    }

    if (action === 'estimate') {
      const type = url.searchParams.get('type') || 'swap';
      const estCu = ACTION_CU[type.toLowerCase()] || 200000;
      const rec = getRecommendation(net, estCu);
      return new Response(JSON.stringify({
        success: true, action: type, computeUnits: estCu,
        network: { level: net.level, score: net.score },
        estimate: rec, supportedActions: Object.keys(ACTION_CU)
      }), { headers });
    }

    if (action === 'batch' && req.method === 'POST') {
      const body = await req.json() as { transactions?: Array<{ id: string; computeUnits: number }> };
      const transactions = body?.transactions;
      
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return new Response(JSON.stringify({
          success: false, error: 'Need transactions array',
          example: { transactions: [{ id: 'tx1', computeUnits: 300000 }] }
        }), { status: 400, headers });
      }

      const MAX = 1_400_000;
      const sorted = [...transactions].sort((a, b) => b.computeUnits - a.computeUnits);
      const batches: Array<{ id: number; txs: string[]; cu: number; cost: number }> = [];
      let batch: string[] = [], batchCu = 0, bid = 1;

      for (const tx of sorted) {
        if (batchCu + tx.computeUnits > MAX && batch.length > 0) {
          batches.push({ id: bid++, txs: batch, cu: batchCu, cost: getRecommendation(net, batchCu).estimatedCost.lamports });
          batch = []; batchCu = 0;
        }
        batch.push(tx.id); batchCu += tx.computeUnits;
      }
      if (batch.length > 0) {
        batches.push({ id: bid, txs: batch, cu: batchCu, cost: getRecommendation(net, batchCu).estimatedCost.lamports });
      }

      const orig = transactions.reduce((s, t) => s + getRecommendation(net, t.computeUnits).estimatedCost.lamports, 0);
      const opt = batches.reduce((s, b) => s + b.cost, 0);

      return new Response(JSON.stringify({
        success: true, network: { level: net.level, score: net.score },
        optimization: {
          originalTxCount: transactions.length, optimizedTxCount: batches.length,
          savings: { lamports: orig - opt, sol: Number(((orig - opt) / 1e9).toFixed(9)), pct: orig > 0 ? Number(((orig - opt) / orig * 100).toFixed(2)) : 0 },
          batches
        }
      }), { headers });
    }

    // Default: full analysis
    const rec = getRecommendation(net, cu);
    const timing = getTiming(net, cu);
    const insights = getInsights(net, rec);

    return new Response(JSON.stringify({
      success: true,
      computeUnits: cu,
      analysis: {
        network: { ...net, timestamp: new Date(net.timestamp).toISOString() },
        recommendation: rec,
        timing,
        aiInsights: insights
      }
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error'
    }), { status: 500, headers });
  }
}
