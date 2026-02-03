/**
 * Real-Time Risk Scoring Stream API (Edge Runtime)
 * 
 * SSE endpoint that streams live risk changes, alerts, and protocol health updates.
 * 
 * GET /api/risk-stream - Connect to live risk monitoring stream
 * GET /api/risk-stream?action=summary - Get current risk summary
 * GET /api/risk-stream?action=alerts - Get recent alerts
 * GET /api/risk-stream?action=health - Get protocol health status
 * GET /api/risk-stream?action=history&protocol=kamino&asset=USDC - Get risk history
 * GET /api/risk-stream?action=trend&protocol=kamino&asset=USDC - Get risk trend
 */

export const config = {
  runtime: 'edge',
};

// ============================================================================
// Types
// ============================================================================

interface RiskSnapshot {
  protocol: string;
  asset: string;
  riskScore: number;
  factors: {
    smartContract: number;
    liquidity: number;
    sustainability: number;
    counterparty: number;
    assetVolatility: number;
  };
  apy: number;
  tvl: number;
  adjustedApy: number;
  warnings: string[];
  positives: string[];
}

interface RiskChange {
  protocol: string;
  asset: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  reason: string;
  recommendation: string;
}

interface RiskAlert {
  type: 'risk_spike' | 'risk_drop' | 'tvl_crash' | 'apy_anomaly';
  severity: 'critical' | 'high' | 'medium' | 'low';
  protocol: string;
  asset?: string;
  title: string;
  description: string;
  suggestedAction?: string;
  timestamp: number;
}

interface ProtocolHealth {
  protocol: string;
  status: 'healthy' | 'degraded' | 'critical';
  avgRiskScore: number;
  riskTrend: 'improving' | 'stable' | 'worsening';
  tvlTotal: number;
  poolCount: number;
  activeAlerts: number;
}

interface StreamEvent {
  id: string;
  type: 'snapshot' | 'change' | 'alert' | 'health' | 'summary' | 'ping';
  timestamp: number;
  data: unknown;
}

// ============================================================================
// Protocol Risk Profiles (for scoring)
// ============================================================================

const PROTOCOL_PROFILES: Record<string, {
  audited: boolean;
  launchDate: string;
  historicalIncidents: number;
  lastIncidentDate?: string;
  centralizationRisk: 'low' | 'medium' | 'high';
  insuranceFund?: boolean;
  baseRiskScore: number;
}> = {
  'kamino': { audited: true, launchDate: '2022-06-01', historicalIncidents: 0, centralizationRisk: 'low', insuranceFund: true, baseRiskScore: 25 },
  'drift': { audited: true, launchDate: '2021-11-01', historicalIncidents: 1, lastIncidentDate: '2022-11-01', centralizationRisk: 'low', insuranceFund: true, baseRiskScore: 30 },
  'jito': { audited: true, launchDate: '2022-11-01', historicalIncidents: 0, centralizationRisk: 'medium', baseRiskScore: 20 },
  'marinade': { audited: true, launchDate: '2021-07-01', historicalIncidents: 0, centralizationRisk: 'low', baseRiskScore: 15 },
  'mango': { audited: true, launchDate: '2021-08-01', historicalIncidents: 1, lastIncidentDate: '2022-10-01', centralizationRisk: 'low', insuranceFund: true, baseRiskScore: 45 },
  'raydium': { audited: true, launchDate: '2021-02-01', historicalIncidents: 1, lastIncidentDate: '2022-12-01', centralizationRisk: 'medium', baseRiskScore: 35 },
  'orca': { audited: true, launchDate: '2021-03-01', historicalIncidents: 0, centralizationRisk: 'low', baseRiskScore: 25 },
  'meteora': { audited: true, launchDate: '2022-12-01', historicalIncidents: 0, centralizationRisk: 'low', baseRiskScore: 30 },
  'lulo': { audited: true, launchDate: '2023-06-01', historicalIncidents: 0, centralizationRisk: 'low', baseRiskScore: 35 },
};

// ============================================================================
// In-memory state (per-isolate)
// ============================================================================

let lastSnapshots: Map<string, RiskSnapshot> = new Map();
let recentChanges: RiskChange[] = [];
let recentAlerts: RiskAlert[] = [];
let protocolHealth: Map<string, ProtocolHealth> = new Map();
let lastPollTime = 0;

// ============================================================================
// Handler
// ============================================================================

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
  const action = url.searchParams.get('action');

  // Non-streaming actions
  if (action) {
    switch (action) {
      case 'summary':
        return handleSummary();
      case 'alerts':
        return handleAlerts(url);
      case 'health':
        return handleHealth(url);
      case 'history':
        return handleHistory(url);
      case 'trend':
        return handleTrend(url);
      case 'current':
        return handleCurrent(url);
      default:
        return new Response(JSON.stringify({
          error: `Unknown action: ${action}`,
          validActions: ['summary', 'alerts', 'health', 'history', 'trend', 'current'],
        }), { status: 400, headers });
    }
  }

  // Default: SSE stream
  return handleStream();
}

// ============================================================================
// Streaming Handler
// ============================================================================

async function handleStream() {
  const encoder = new TextEncoder();
  let eventId = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        const data = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Send initial summary
        send({
          id: `event-${++eventId}`,
          type: 'summary',
          timestamp: Date.now(),
          data: {
            message: '🔬 Connected to Real-Time Risk Monitor',
            monitored: lastSnapshots.size,
            protocols: protocolHealth.size,
            activeAlerts: recentAlerts.filter(a => Date.now() - a.timestamp < 3600000).length,
          },
        });

        // Main monitoring loop
        let cycles = 0;
        const maxCycles = 120; // 20 minutes max
        
        while (cycles < maxCycles) {
          cycles++;
          
          // Fetch and analyze yields
          const analyzed = await fetchAndAnalyze();
          
          // Process each opportunity
          for (const opp of analyzed) {
            const key = `${opp.protocol}:${opp.asset}`;
            const previous = lastSnapshots.get(key);
            
            const snapshot: RiskSnapshot = {
              protocol: opp.protocol,
              asset: opp.asset,
              riskScore: opp.riskScore,
              factors: opp.factors,
              apy: opp.apy,
              tvl: opp.tvl,
              adjustedApy: opp.adjustedApy,
              warnings: opp.warnings,
              positives: opp.positives,
            };

            // Detect changes
            if (previous) {
              const delta = snapshot.riskScore - previous.riskScore;
              
              if (Math.abs(delta) >= 5) {
                const change: RiskChange = {
                  protocol: opp.protocol,
                  asset: opp.asset,
                  previousScore: previous.riskScore,
                  currentScore: snapshot.riskScore,
                  delta,
                  severity: getSeverity(delta, snapshot.riskScore),
                  reason: getChangeReason(previous, snapshot),
                  recommendation: getRecommendation(delta, snapshot),
                };

                recentChanges.unshift(change);
                if (recentChanges.length > 100) recentChanges.pop();

                // Send change event
                send({
                  id: `event-${++eventId}`,
                  type: 'change',
                  timestamp: Date.now(),
                  data: change,
                });

                // Generate alert if significant
                if (change.severity !== 'info' && change.severity !== 'low') {
                  const alert: RiskAlert = {
                    type: delta > 0 ? 'risk_spike' : 'risk_drop',
                    severity: change.severity as 'critical' | 'high' | 'medium' | 'low',
                    protocol: opp.protocol,
                    asset: opp.asset,
                    title: `${delta > 0 ? '⚠️ Risk Spike' : '📉 Risk Drop'}: ${opp.protocol} ${opp.asset}`,
                    description: `Risk score ${delta > 0 ? 'increased' : 'decreased'} from ${previous.riskScore} to ${snapshot.riskScore}`,
                    suggestedAction: change.recommendation,
                    timestamp: Date.now(),
                  };

                  recentAlerts.unshift(alert);
                  if (recentAlerts.length > 50) recentAlerts.pop();

                  send({
                    id: `event-${++eventId}`,
                    type: 'alert',
                    timestamp: Date.now(),
                    data: alert,
                  });
                }
              }

              // Check for TVL crash
              if (previous.tvl > 0) {
                const tvlDrop = (previous.tvl - snapshot.tvl) / previous.tvl;
                if (tvlDrop > 0.2) {
                  const alert: RiskAlert = {
                    type: 'tvl_crash',
                    severity: tvlDrop > 0.5 ? 'critical' : tvlDrop > 0.3 ? 'high' : 'medium',
                    protocol: opp.protocol,
                    asset: opp.asset,
                    title: `🚨 TVL Drop: ${opp.protocol} ${opp.asset}`,
                    description: `TVL dropped ${(tvlDrop * 100).toFixed(1)}%`,
                    suggestedAction: tvlDrop > 0.5 ? 'Consider immediate withdrawal' : 'Monitor closely',
                    timestamp: Date.now(),
                  };

                  recentAlerts.unshift(alert);
                  send({ id: `event-${++eventId}`, type: 'alert', timestamp: Date.now(), data: alert });
                }
              }

              // Check for APY anomaly
              if (previous.apy > 0) {
                const apyChange = Math.abs(snapshot.apy - previous.apy) / previous.apy;
                if (apyChange > 0.5) {
                  const alert: RiskAlert = {
                    type: 'apy_anomaly',
                    severity: apyChange > 1 ? 'high' : 'medium',
                    protocol: opp.protocol,
                    asset: opp.asset,
                    title: `📊 APY ${snapshot.apy > previous.apy ? 'Spike' : 'Drop'}: ${opp.protocol}`,
                    description: `APY changed ${(apyChange * 100).toFixed(1)}% from ${previous.apy.toFixed(1)}% to ${snapshot.apy.toFixed(1)}%`,
                    timestamp: Date.now(),
                  };

                  recentAlerts.unshift(alert);
                  send({ id: `event-${++eventId}`, type: 'alert', timestamp: Date.now(), data: alert });
                }
              }
            }

            // Update snapshot
            lastSnapshots.set(key, snapshot);
          }

          // Update protocol health
          updateProtocolHealth(analyzed);
          
          // Emit health update every 5 cycles
          if (cycles % 5 === 0) {
            const healthSummary = Array.from(protocolHealth.values());
            send({
              id: `event-${++eventId}`,
              type: 'health',
              timestamp: Date.now(),
              data: {
                protocols: healthSummary,
                summary: {
                  healthy: healthSummary.filter(h => h.status === 'healthy').length,
                  degraded: healthSummary.filter(h => h.status === 'degraded').length,
                  critical: healthSummary.filter(h => h.status === 'critical').length,
                },
              },
            });
          }

          // Periodic ping
          if (cycles % 3 === 0) {
            send({
              id: `event-${++eventId}`,
              type: 'ping',
              timestamp: Date.now(),
              data: {
                uptime: cycles * 10,
                monitored: lastSnapshots.size,
                activeAlerts: recentAlerts.filter(a => Date.now() - a.timestamp < 3600000).length,
              },
            });
          }

          lastPollTime = Date.now();
          
          // Wait before next poll (10 seconds)
          await sleep(10000);
        }

        controller.close();

      } catch (err) {
        send({
          id: `event-${++eventId}`,
          type: 'alert',
          timestamp: Date.now(),
          data: {
            type: 'risk_spike',
            severity: 'high',
            protocol: 'system',
            title: '⚠️ Stream Error',
            description: `Monitoring error: ${err}`,
            timestamp: Date.now(),
          },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ============================================================================
// REST Handlers
// ============================================================================

async function handleSummary() {
  // Ensure we have data
  if (lastSnapshots.size === 0) {
    const analyzed = await fetchAndAnalyze();
    for (const opp of analyzed) {
      lastSnapshots.set(`${opp.protocol}:${opp.asset}`, {
        protocol: opp.protocol,
        asset: opp.asset,
        riskScore: opp.riskScore,
        factors: opp.factors,
        apy: opp.apy,
        tvl: opp.tvl,
        adjustedApy: opp.adjustedApy,
        warnings: opp.warnings,
        positives: opp.positives,
      });
    }
    updateProtocolHealth(analyzed);
  }

  const snapshots = Array.from(lastSnapshots.values());
  const avgRisk = snapshots.length > 0 
    ? snapshots.reduce((s, snap) => s + snap.riskScore, 0) / snapshots.length 
    : 0;

  const health = Array.from(protocolHealth.values());

  return new Response(JSON.stringify({
    status: 'active',
    lastPoll: lastPollTime ? new Date(lastPollTime).toISOString() : null,
    monitoring: {
      pools: lastSnapshots.size,
      protocols: protocolHealth.size,
    },
    riskSummary: {
      average: Math.round(avgRisk),
      low: snapshots.filter(s => s.riskScore < 35).length,
      medium: snapshots.filter(s => s.riskScore >= 35 && s.riskScore < 55).length,
      high: snapshots.filter(s => s.riskScore >= 55).length,
    },
    alerts: {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
      high: recentAlerts.filter(a => a.severity === 'high').length,
      lastHour: recentAlerts.filter(a => Date.now() - a.timestamp < 3600000).length,
    },
    protocolHealth: {
      healthy: health.filter(h => h.status === 'healthy').length,
      degraded: health.filter(h => h.status === 'degraded').length,
      critical: health.filter(h => h.status === 'critical').length,
    },
    recentChanges: recentChanges.slice(0, 5),
  }), { headers });
}

async function handleAlerts(url: URL) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const severity = url.searchParams.get('severity');
  const protocol = url.searchParams.get('protocol');

  let filtered = [...recentAlerts];
  if (severity) {
    filtered = filtered.filter(a => a.severity === severity);
  }
  if (protocol) {
    filtered = filtered.filter(a => a.protocol === protocol);
  }

  return new Response(JSON.stringify({
    count: filtered.length,
    alerts: filtered.slice(0, limit),
  }), { headers });
}

async function handleHealth(url: URL) {
  const protocol = url.searchParams.get('protocol');

  // Ensure we have data
  if (protocolHealth.size === 0) {
    const analyzed = await fetchAndAnalyze();
    updateProtocolHealth(analyzed);
  }

  if (protocol) {
    const health = protocolHealth.get(protocol);
    if (!health) {
      return new Response(JSON.stringify({ error: `Protocol not found: ${protocol}` }), { status: 404, headers });
    }
    return new Response(JSON.stringify(health), { headers });
  }

  return new Response(JSON.stringify({
    protocols: Array.from(protocolHealth.values()),
  }), { headers });
}

async function handleHistory(url: URL) {
  const protocol = url.searchParams.get('protocol');
  const asset = url.searchParams.get('asset');

  if (!protocol || !asset) {
    return new Response(JSON.stringify({ error: 'Required: protocol, asset' }), { status: 400, headers });
  }

  const key = `${protocol}:${asset}`;
  const current = lastSnapshots.get(key);

  if (!current) {
    return new Response(JSON.stringify({ 
      error: `No data for ${protocol} ${asset}`,
      available: Array.from(lastSnapshots.keys()),
    }), { status: 404, headers });
  }

  // Note: Full history requires persistent storage; return current snapshot
  return new Response(JSON.stringify({
    current,
    note: 'Historical data requires persistent storage. Connect to /api/risk-stream for live updates.',
  }), { headers });
}

async function handleTrend(url: URL) {
  const protocol = url.searchParams.get('protocol');
  const asset = url.searchParams.get('asset');

  if (!protocol || !asset) {
    return new Response(JSON.stringify({ error: 'Required: protocol, asset' }), { status: 400, headers });
  }

  const key = `${protocol}:${asset}`;
  const current = lastSnapshots.get(key);

  if (!current) {
    return new Response(JSON.stringify({ error: `No data for ${protocol} ${asset}` }), { status: 404, headers });
  }

  // Get recent changes for this asset
  const changes = recentChanges.filter(c => c.protocol === protocol && c.asset === asset);

  return new Response(JSON.stringify({
    protocol,
    asset,
    current: current.riskScore,
    recentChanges: changes.slice(0, 10),
    trend: changes.length > 0 
      ? (changes[0].delta > 0 ? 'worsening' : changes[0].delta < 0 ? 'improving' : 'stable')
      : 'stable',
  }), { headers });
}

async function handleCurrent(url: URL) {
  const protocol = url.searchParams.get('protocol');
  
  // Ensure we have data
  if (lastSnapshots.size === 0) {
    const analyzed = await fetchAndAnalyze();
    for (const opp of analyzed) {
      lastSnapshots.set(`${opp.protocol}:${opp.asset}`, {
        protocol: opp.protocol,
        asset: opp.asset,
        riskScore: opp.riskScore,
        factors: opp.factors,
        apy: opp.apy,
        tvl: opp.tvl,
        adjustedApy: opp.adjustedApy,
        warnings: opp.warnings,
        positives: opp.positives,
      });
    }
  }

  let snapshots = Array.from(lastSnapshots.values());
  if (protocol) {
    snapshots = snapshots.filter(s => s.protocol === protocol);
  }

  return new Response(JSON.stringify({
    count: snapshots.length,
    snapshots: snapshots.sort((a, b) => a.riskScore - b.riskScore),
  }), { headers });
}

// ============================================================================
// Core Functions
// ============================================================================

async function fetchAndAnalyze(): Promise<Array<{
  protocol: string;
  asset: string;
  riskScore: number;
  factors: RiskSnapshot['factors'];
  apy: number;
  tvl: number;
  adjustedApy: number;
  warnings: string[];
  positives: string[];
}>> {
  const response = await fetch('https://yields.llama.fi/pools');
  const data = await response.json();

  return data.data
    .filter((p: any) => p.chain === 'Solana' && p.tvlUsd >= 50000 && p.apy > 0)
    .slice(0, 100)
    .map((p: any) => {
      const protocol = normalizeProtocol(p.project);
      const { riskScore, factors, warnings, positives } = calculateRisk(p, protocol);
      const adjustedApy = p.apy * (1 - riskScore / 200);

      return {
        protocol,
        asset: p.symbol,
        riskScore,
        factors,
        apy: p.apy,
        tvl: p.tvlUsd,
        adjustedApy,
        warnings,
        positives,
      };
    });
}

function normalizeProtocol(project: string): string {
  const lower = project.toLowerCase();
  for (const proto of Object.keys(PROTOCOL_PROFILES)) {
    if (lower.includes(proto)) return proto;
  }
  return project;
}

function calculateRisk(pool: any, protocol: string): {
  riskScore: number;
  factors: RiskSnapshot['factors'];
  warnings: string[];
  positives: string[];
} {
  const profile = PROTOCOL_PROFILES[protocol] || { audited: false, launchDate: '2024-01-01', historicalIncidents: 0, centralizationRisk: 'high', baseRiskScore: 70 };
  const warnings: string[] = [];
  const positives: string[] = [];

  // Smart Contract
  let smartContract = profile.baseRiskScore;
  if (!profile.audited) {
    smartContract += 30;
    warnings.push('Not audited');
  } else {
    positives.push('Audited protocol');
  }
  if (profile.historicalIncidents > 0 && profile.lastIncidentDate) {
    const daysSince = (Date.now() - new Date(profile.lastIncidentDate).getTime()) / 86400000;
    if (daysSince < 365) smartContract += 20;
  }
  smartContract = clamp(smartContract, 0, 100);

  // Liquidity
  let liquidity = pool.tvlUsd < 100000 ? 90 : pool.tvlUsd < 1000000 ? 60 : pool.tvlUsd < 10000000 ? 40 : pool.tvlUsd < 100000000 ? 20 : 10;
  if (pool.tvlUsd > 10000000) positives.push(`Strong TVL ($${(pool.tvlUsd / 1e6).toFixed(1)}M)`);
  if (pool.tvlUsd < 1000000) warnings.push(`Low TVL ($${(pool.tvlUsd / 1e3).toFixed(0)}K)`);

  // Sustainability
  let sustainability = pool.apy > 100 ? 90 : pool.apy > 50 ? 70 : pool.apy > 25 ? 40 : pool.apy > 10 ? 20 : 10;
  if (pool.apy > 50) warnings.push('Very high APY may be unsustainable');
  if (pool.apy < 20) positives.push('Sustainable APY range');

  // Counterparty
  let counterparty = profile.centralizationRisk === 'high' ? 60 : profile.centralizationRisk === 'medium' ? 35 : 15;
  if (profile.insuranceFund) positives.push('Has insurance fund');

  // Asset Volatility
  const isStable = pool.stablecoin || ['usd', 'usdc', 'usdt', 'dai'].some((s: string) => pool.symbol.toLowerCase().includes(s));
  let assetVolatility = isStable ? 10 : pool.symbol.toLowerCase().includes('sol') ? 40 : 50;
  if (isStable) positives.push('Stablecoin - low volatility');

  const overall = Math.round(
    smartContract * 0.30 +
    liquidity * 0.20 +
    sustainability * 0.20 +
    counterparty * 0.15 +
    assetVolatility * 0.15
  );

  return {
    riskScore: overall,
    factors: { smartContract, liquidity, sustainability, counterparty, assetVolatility },
    warnings,
    positives,
  };
}

function updateProtocolHealth(analyzed: Array<{ protocol: string; riskScore: number; tvl: number }>) {
  const byProtocol = new Map<string, typeof analyzed>();
  
  for (const opp of analyzed) {
    const existing = byProtocol.get(opp.protocol) || [];
    existing.push(opp);
    byProtocol.set(opp.protocol, existing);
  }

  for (const [protocol, opps] of byProtocol) {
    const avgRisk = opps.reduce((s, o) => s + o.riskScore, 0) / opps.length;
    const totalTvl = opps.reduce((s, o) => s + o.tvl, 0);
    const activeAlerts = recentAlerts.filter(a => a.protocol === protocol && Date.now() - a.timestamp < 3600000).length;

    const status: ProtocolHealth['status'] = avgRisk >= 70 || activeAlerts >= 3 ? 'critical' : avgRisk >= 50 || activeAlerts >= 1 ? 'degraded' : 'healthy';

    // Determine trend from recent changes
    const changes = recentChanges.filter(c => c.protocol === protocol).slice(0, 5);
    const avgDelta = changes.length > 0 ? changes.reduce((s, c) => s + c.delta, 0) / changes.length : 0;
    const riskTrend: ProtocolHealth['riskTrend'] = avgDelta < -2 ? 'improving' : avgDelta > 2 ? 'worsening' : 'stable';

    protocolHealth.set(protocol, {
      protocol,
      status,
      avgRiskScore: Math.round(avgRisk),
      riskTrend,
      tvlTotal: totalTvl,
      poolCount: opps.length,
      activeAlerts,
    });
  }
}

function getSeverity(delta: number, currentScore: number): RiskChange['severity'] {
  if (Math.abs(delta) >= 20 || currentScore >= 70) return 'critical';
  if (Math.abs(delta) >= 15) return 'high';
  if (Math.abs(delta) >= 10) return 'medium';
  if (Math.abs(delta) >= 5) return 'low';
  return 'info';
}

function getChangeReason(prev: RiskSnapshot, curr: RiskSnapshot): string {
  const factorDiffs: { factor: string; delta: number }[] = [];
  
  for (const key of ['smartContract', 'liquidity', 'sustainability', 'counterparty', 'assetVolatility'] as const) {
    const delta = curr.factors[key] - prev.factors[key];
    if (Math.abs(delta) >= 3) {
      factorDiffs.push({ factor: key, delta });
    }
  }

  if (factorDiffs.length === 0) return 'Cumulative changes across factors';

  const primary = factorDiffs.reduce((max, f) => Math.abs(f.delta) > Math.abs(max.delta) ? f : max);
  const reasons: Record<string, string> = {
    smartContract: 'Smart contract risk changed',
    liquidity: 'Liquidity/TVL changed',
    sustainability: 'APY sustainability concern',
    counterparty: 'Counterparty risk changed',
    assetVolatility: 'Asset volatility changed',
  };

  return reasons[primary.factor] || 'Risk profile changed';
}

function getRecommendation(delta: number, snapshot: RiskSnapshot): string {
  if (delta > 0) {
    if (snapshot.riskScore >= 70) return `URGENT: Consider withdrawal from ${snapshot.protocol} ${snapshot.asset}`;
    if (snapshot.riskScore >= 55) return `Review exposure to ${snapshot.protocol} ${snapshot.asset}`;
    return `Monitor ${snapshot.protocol} ${snapshot.asset} closely`;
  }
  if (snapshot.riskScore < 35) return `${snapshot.protocol} ${snapshot.asset} now low-risk - consider as target`;
  return `Risk improved for ${snapshot.protocol} ${snapshot.asset}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
