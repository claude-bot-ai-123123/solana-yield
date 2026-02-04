/**
 * Real-time Yield Alert System API
 * 
 * Comprehensive alerting for DeFi yield monitoring.
 */

export const config = {
  runtime: 'edge',
};

// ============================================================================
// Types
// ============================================================================

type AlertType = 
  | 'apy_above'
  | 'apy_below'
  | 'apy_change'
  | 'tvl_change'
  | 'risk_increase'
  | 'risk_decrease'
  | 'new_opportunity';

interface AlertCondition {
  id: string;
  type: AlertType;
  enabled: boolean;
  createdAt: number;
  protocol?: string;
  asset?: string;
  threshold?: number;
  changePercent?: number;
  minApy?: number;
  maxRiskScore?: number;
  cooldownMs: number;
  lastTriggered?: number;
  triggerCount: number;
}

interface Alert {
  id: string;
  conditionId: string;
  type: AlertType;
  timestamp: number;
  protocol: string;
  asset: string;
  currentValue: number;
  previousValue?: number;
  threshold?: number;
  changePercent?: number;
  riskScore?: number;
  tvl?: number;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  acknowledged: boolean;
}

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_CONDITIONS: AlertCondition[] = [
  {
    id: 'demo_1',
    type: 'apy_above',
    enabled: true,
    createdAt: Date.now() - 86400000,
    protocol: '*',
    asset: '*',
    threshold: 15,
    cooldownMs: 3600000,
    triggerCount: 3,
  },
  {
    id: 'demo_2',
    type: 'tvl_change',
    enabled: true,
    createdAt: Date.now() - 86400000,
    protocol: '*',
    asset: '*',
    changePercent: 25,
    cooldownMs: 1800000,
    triggerCount: 1,
  },
  {
    id: 'demo_3',
    type: 'risk_increase',
    enabled: true,
    createdAt: Date.now() - 86400000,
    protocol: '*',
    asset: '*',
    threshold: 15,
    cooldownMs: 3600000,
    triggerCount: 0,
  },
];

const DEMO_ALERTS: Alert[] = [
  {
    id: 'alert_1',
    conditionId: 'demo_1',
    type: 'apy_above',
    timestamp: Date.now() - 3600000,
    protocol: 'kamino',
    asset: 'USDC',
    currentValue: 18.5,
    threshold: 15,
    title: '🚀 APY Alert: kamino USDC',
    message: 'APY is now 18.50% (above 15% threshold)',
    severity: 'info',
    acknowledged: false,
  },
  {
    id: 'alert_2',
    conditionId: 'demo_2',
    type: 'tvl_change',
    timestamp: Date.now() - 7200000,
    protocol: 'drift',
    asset: 'SOL',
    currentValue: 12.3,
    previousValue: 9.1,
    changePercent: 35.2,
    title: '💰 TVL Change: drift SOL',
    message: 'TVL changed +35.2% ($9.1M → $12.3M)',
    severity: 'warning',
    acknowledged: true,
  },
];

// ============================================================================
// Handler (Edge Runtime)
// ============================================================================

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: HEADERS,
  });
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case null:
      case 'overview':
        return json(getOverview());
        
      case 'conditions':
        return json(getConditions());
        
      case 'create':
        return await handleCreate(request);
        
      case 'history':
        return json(getHistory(url));
        
      case 'stats':
        return json(getStats());
        
      case 'presets':
        return await handlePresets(request, url);
        
      case 'check':
        return await handleCheck(request);
        
      case 'acknowledge':
        return handleAcknowledge(url);
        
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: `Internal error: ${err}` }, 500);
  }
}

// ============================================================================
// Handlers
// ============================================================================

function getOverview() {
  const stats = calculateStats();
  
  return {
    name: 'SolanaYield Real-time Alert System',
    version: '1.0.0',
    description: 'Configure alerts for yield changes, risk events, and new opportunities',
    stats: {
      activeConditions: stats.activeConditions,
      totalAlerts: stats.totalAlerts,
      alertsToday: stats.alertsToday,
    },
    monitoringInterval: '5 minutes',
    endpoints: {
      'GET ?action=conditions': 'List all alert conditions',
      'POST ?action=create': 'Create a new alert condition',
      'GET ?action=history': 'Get triggered alerts (?limit=50&type=apy_above)',
      'GET ?action=stats': 'Alert statistics',
      'POST ?action=acknowledge&id=xxx': 'Acknowledge an alert',
      'GET ?action=presets': 'List available alert presets',
      'POST ?action=presets&preset=yield-hunter': 'Create alerts from preset',
      'POST ?action=check': 'Trigger manual alert check',
    },
    alertTypes: {
      apy_above: 'APY rises above threshold',
      apy_below: 'APY drops below threshold',
      apy_change: 'APY changes by X% from baseline',
      tvl_change: 'TVL changes significantly',
      risk_increase: 'Risk score increases',
      risk_decrease: 'Risk score decreases',
      new_opportunity: 'New high-yield opportunity discovered',
    },
    presets: ['whale-alert', 'yield-hunter', 'risk-monitor', 'conservative'],
    ui: '/api/yield-alerts-ui',
    example: {
      createCondition: {
        method: 'POST',
        url: '/api/yield-alerts?action=create',
        body: {
          type: 'apy_above',
          protocol: 'kamino',
          threshold: 15,
          cooldownMs: 3600000,
        },
      },
    },
  };
}

function getConditions() {
  return {
    count: DEMO_CONDITIONS.length,
    conditions: DEMO_CONDITIONS.map(c => ({
      id: c.id,
      type: c.type,
      enabled: c.enabled,
      protocol: c.protocol || '*',
      asset: c.asset || '*',
      threshold: c.threshold,
      changePercent: c.changePercent,
      cooldownMs: c.cooldownMs,
      cooldownHuman: `${Math.round(c.cooldownMs / 60000)} minutes`,
      triggerCount: c.triggerCount,
      lastTriggered: c.lastTriggered ? new Date(c.lastTriggered).toISOString() : null,
      createdAt: new Date(c.createdAt).toISOString(),
    })),
  };
}

async function handleCreate(request: Request) {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST' }, 405);
  }
  
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  
  const validTypes: AlertType[] = [
    'apy_above', 'apy_below', 'apy_change', 'tvl_change',
    'risk_increase', 'risk_decrease', 'new_opportunity'
  ];
  
  if (!body.type || !validTypes.includes(body.type)) {
    return json({
      error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
    }, 400);
  }
  
  const condition: AlertCondition = {
    id: `cond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: body.type,
    enabled: body.enabled !== false,
    createdAt: Date.now(),
    protocol: body.protocol || '*',
    asset: body.asset || '*',
    threshold: body.threshold,
    changePercent: body.changePercent,
    minApy: body.minApy,
    maxRiskScore: body.maxRiskScore,
    cooldownMs: body.cooldownMs || 60 * 60 * 1000,
    triggerCount: 0,
  };
  
  DEMO_CONDITIONS.push(condition);
  
  return json({
    success: true,
    message: 'Alert condition created',
    condition,
    note: 'Demo mode - will not persist across requests',
  });
}

function getHistory(url: URL) {
  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const type = url.searchParams.get('type');
  const protocol = url.searchParams.get('protocol');
  const severity = url.searchParams.get('severity');
  const unacknowledged = url.searchParams.get('unacknowledged');
  
  let filtered = [...DEMO_ALERTS];
  
  if (type) filtered = filtered.filter(a => a.type === type);
  if (protocol) filtered = filtered.filter(a => a.protocol === protocol);
  if (severity) filtered = filtered.filter(a => a.severity === severity);
  if (unacknowledged === 'true') filtered = filtered.filter(a => !a.acknowledged);
  
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  
  const start = parseInt(offset || '0');
  const count = parseInt(limit || '50');
  
  return {
    count: filtered.length,
    alerts: filtered.slice(start, start + count).map(a => ({
      ...a,
      time: new Date(a.timestamp).toISOString(),
    })),
  };
}

function getStats() {
  const stats = calculateStats();
  
  return {
    summary: {
      totalConditions: stats.totalConditions,
      activeConditions: stats.activeConditions,
      totalAlerts: stats.totalAlerts,
      alertsToday: stats.alertsToday,
    },
    byAlertType: stats.byType,
    bySeverity: stats.bySeverity,
    byProtocol: stats.byProtocol,
    topTriggeringConditions: stats.topTriggering,
  };
}

async function handlePresets(request: Request, url: URL) {
  const preset = url.searchParams.get('preset');
  
  if (request.method === 'GET' && !preset) {
    return json({
      presets: {
        'whale-alert': {
          description: 'Track large TVL movements (>25% changes)',
          conditions: ['tvl_change @ 25%'],
        },
        'yield-hunter': {
          description: 'Alert on high APY opportunities',
          conditions: ['new_opportunity @ 15% APY', 'apy_above @ 20%'],
        },
        'risk-monitor': {
          description: 'Track risk score and APY volatility',
          conditions: ['risk_increase @ 15 points', 'apy_change @ 30%'],
        },
        'conservative': {
          description: 'Stablecoin-focused, low-risk alerts',
          conditions: ['apy_below USDC @ 5%', 'risk_increase @ 10 points'],
        },
      },
      usage: 'POST /api/yield-alerts?action=presets&preset=yield-hunter',
    });
  }
  
  if (request.method !== 'POST') {
    return json({ error: 'Use POST to create presets' }, 405);
  }
  
  const validPresets = ['whale-alert', 'yield-hunter', 'risk-monitor', 'conservative'];
  
  if (!preset || !validPresets.includes(preset)) {
    return json({
      error: `Invalid preset. Must be one of: ${validPresets.join(', ')}`,
    }, 400);
  }
  
  const conditions: AlertCondition[] = [];
  
  switch (preset) {
    case 'whale-alert':
      conditions.push(createCondition('tvl_change', { changePercent: 25 }));
      break;
    case 'yield-hunter':
      conditions.push(createCondition('new_opportunity', { minApy: 15, maxRiskScore: 45 }));
      conditions.push(createCondition('apy_above', { threshold: 20 }));
      break;
    case 'risk-monitor':
      conditions.push(createCondition('risk_increase', { threshold: 15 }));
      conditions.push(createCondition('apy_change', { changePercent: 30 }));
      break;
    case 'conservative':
      conditions.push(createCondition('apy_below', { threshold: 5, asset: 'USDC' }));
      conditions.push(createCondition('risk_increase', { threshold: 10 }));
      break;
  }
  
  return json({
    success: true,
    preset,
    conditionsCreated: conditions.length,
    conditions: conditions.map(c => ({
      id: c.id,
      type: c.type,
      threshold: c.threshold,
      changePercent: c.changePercent,
    })),
  });
}

async function handleCheck(request: Request) {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST' }, 405);
  }
  
  // Fetch yields from DeFi Llama
  let yields: any[] = [];
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    yields = data.data
      .filter((p: any) => p.chain === 'Solana' && p.tvlUsd > 100000)
      .slice(0, 50)
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: p.apy || 0,
        tvl: p.tvlUsd,
        riskScore: estimateRisk(p),
      }));
  } catch (err) {
    return json({ error: `Failed to fetch yields: ${err}` }, 500);
  }
  
  // Check conditions
  const newAlerts = checkConditions(yields);
  
  return json({
    success: true,
    message: 'Alert check completed',
    yieldsChecked: yields.length,
    conditionsEvaluated: DEMO_CONDITIONS.filter(c => c.enabled).length,
    alertsGenerated: newAlerts.length,
    alerts: newAlerts,
  });
}

function handleAcknowledge(url: URL) {
  const id = url.searchParams.get('id');
  
  if (!id) {
    const count = DEMO_ALERTS.filter(a => !a.acknowledged).length;
    DEMO_ALERTS.forEach(a => a.acknowledged = true);
    return json({ success: true, acknowledgedCount: count });
  }
  
  const alert = DEMO_ALERTS.find(a => a.id === id);
  if (!alert) {
    return json({ error: `Alert not found: ${id}` }, 404);
  }
  
  alert.acknowledged = true;
  return json({ success: true, message: `Alert ${id} acknowledged` });
}

// ============================================================================
// Helpers
// ============================================================================

function calculateStats() {
  const now = Date.now();
  const dayStart = now - 24 * 60 * 60 * 1000;
  
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byProtocol: Record<string, number> = {};
  
  for (const alert of DEMO_ALERTS) {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    byProtocol[alert.protocol] = (byProtocol[alert.protocol] || 0) + 1;
  }
  
  return {
    totalConditions: DEMO_CONDITIONS.length,
    activeConditions: DEMO_CONDITIONS.filter(c => c.enabled).length,
    totalAlerts: DEMO_ALERTS.length,
    alertsToday: DEMO_ALERTS.filter(a => a.timestamp >= dayStart).length,
    byType,
    bySeverity,
    byProtocol,
    topTriggering: DEMO_CONDITIONS
      .filter(c => c.triggerCount > 0)
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 5)
      .map(c => ({ conditionId: c.id, type: c.type, count: c.triggerCount })),
  };
}

function createCondition(type: AlertType, params: Partial<AlertCondition>): AlertCondition {
  const c: AlertCondition = {
    id: `cond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    enabled: true,
    createdAt: Date.now(),
    protocol: '*',
    asset: '*',
    cooldownMs: 60 * 60 * 1000,
    triggerCount: 0,
    ...params,
  };
  DEMO_CONDITIONS.push(c);
  return c;
}

function estimateRisk(pool: any): number {
  let risk = 30;
  if (pool.tvlUsd < 1_000_000) risk += 20;
  else if (pool.tvlUsd < 10_000_000) risk += 10;
  else if (pool.tvlUsd > 100_000_000) risk -= 10;
  if (pool.apy > 100) risk += 30;
  else if (pool.apy > 50) risk += 15;
  else if (pool.apy > 20) risk += 5;
  const trusted = ['kamino', 'drift', 'jito-staking', 'marinade-finance', 'marginfi'];
  if (trusted.includes(pool.project)) risk -= 15;
  return Math.max(0, Math.min(100, risk));
}

function checkConditions(yields: any[]): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();
  
  for (const condition of DEMO_CONDITIONS) {
    if (!condition.enabled) continue;
    if (condition.lastTriggered && (now - condition.lastTriggered) < condition.cooldownMs) continue;
    
    for (const y of yields) {
      if (condition.protocol && condition.protocol !== '*' && y.protocol !== condition.protocol) continue;
      if (condition.asset && condition.asset !== '*' && y.asset !== condition.asset) continue;
      
      let triggered = false;
      let title = '';
      let message = '';
      let severity: 'info' | 'warning' | 'critical' = 'info';
      
      switch (condition.type) {
        case 'apy_above':
          if (y.apy >= (condition.threshold || 0)) {
            triggered = true;
            title = `🚀 APY Alert: ${y.protocol} ${y.asset}`;
            message = `APY is now ${y.apy.toFixed(2)}% (above ${condition.threshold}% threshold)`;
            severity = y.apy > (condition.threshold || 0) * 1.5 ? 'warning' : 'info';
          }
          break;
        case 'apy_below':
          if (y.apy <= (condition.threshold || 0)) {
            triggered = true;
            title = `⚠️ APY Drop: ${y.protocol} ${y.asset}`;
            message = `APY dropped to ${y.apy.toFixed(2)}% (below ${condition.threshold}%)`;
            severity = 'warning';
          }
          break;
        case 'risk_increase':
          if (y.riskScore && y.riskScore >= (condition.threshold || 50)) {
            triggered = true;
            title = `🔴 High Risk: ${y.protocol} ${y.asset}`;
            message = `Risk score is ${y.riskScore} (threshold: ${condition.threshold})`;
            severity = y.riskScore > 70 ? 'critical' : 'warning';
          }
          break;
        case 'new_opportunity':
          const minApy = condition.minApy || 10;
          const maxRisk = condition.maxRiskScore || 50;
          if (y.apy >= minApy && (!y.riskScore || y.riskScore <= maxRisk)) {
            triggered = true;
            title = `✨ Opportunity: ${y.protocol} ${y.asset}`;
            message = `${y.apy.toFixed(2)}% APY, risk: ${y.riskScore || 'N/A'}`;
          }
          break;
      }
      
      if (triggered) {
        const alert: Alert = {
          id: `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          conditionId: condition.id,
          type: condition.type,
          timestamp: now,
          protocol: y.protocol,
          asset: y.asset,
          currentValue: y.apy,
          threshold: condition.threshold,
          riskScore: y.riskScore,
          tvl: y.tvl,
          title,
          message,
          severity,
          acknowledged: false,
        };
        
        alerts.push(alert);
        DEMO_ALERTS.push(alert);
        condition.lastTriggered = now;
        condition.triggerCount++;
        break;
      }
    }
  }
  
  return alerts;
}
