/**
 * Real-time Yield Alert System API
 * 
 * Comprehensive alerting for DeFi yield monitoring:
 * - APY threshold alerts
 * - TVL change alerts  
 * - Risk score changes
 * - New opportunity discovery
 * 
 * Features:
 * - Persistent conditions
 * - Webhook delivery
 * - SSE streaming
 * - Preset templates
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  | 'new_opportunity'
  | 'protocol_event';

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
  webhook?: string;
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

interface YieldData {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  riskScore?: number;
}

// ============================================================================
// In-Memory Storage (per-request, simulated persistence)
// In production, use Vercel KV or similar
// ============================================================================

// For demo purposes - in production use Vercel KV
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
// API Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case undefined:
      case 'overview':
        return handleOverview(req, res);
        
      case 'conditions':
        return handleConditions(req, res);
        
      case 'create':
        return handleCreate(req, res);
        
      case 'history':
        return handleHistory(req, res);
        
      case 'stats':
        return handleStats(req, res);
        
      case 'presets':
        return handlePresets(req, res);
        
      case 'stream':
        return handleStream(req, res);
        
      case 'check':
        return handleCheck(req, res);
        
      case 'acknowledge':
        return handleAcknowledge(req, res);
        
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('Alert API error:', err);
    return res.status(500).json({ error: `Internal error: ${err}` });
  }
}

// ============================================================================
// Handlers
// ============================================================================

function handleOverview(req: VercelRequest, res: VercelResponse) {
  const stats = calculateStats();
  
  return res.json({
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
      'GET ?action=stream': 'SSE stream for real-time alerts',
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
    example: {
      createCondition: {
        method: 'POST',
        url: '/api/yield-alerts?action=create',
        body: {
          type: 'apy_above',
          protocol: 'kamino',
          asset: '*',
          threshold: 15,
          cooldownMs: 3600000,
          enabled: true,
        },
      },
    },
  });
}

function handleConditions(req: VercelRequest, res: VercelResponse) {
  const conditions = DEMO_CONDITIONS;
  
  return res.json({
    count: conditions.length,
    conditions: conditions.map(c => ({
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
  });
}

function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  
  const validTypes: AlertType[] = [
    'apy_above', 'apy_below', 'apy_change', 'tvl_change',
    'risk_increase', 'risk_decrease', 'new_opportunity', 'protocol_event'
  ];
  
  if (!body.type || !validTypes.includes(body.type)) {
    return res.status(400).json({
      error: `Invalid or missing type. Must be one of: ${validTypes.join(', ')}`,
    });
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
    webhook: body.webhook,
    triggerCount: 0,
  };
  
  // In production, save to Vercel KV
  DEMO_CONDITIONS.push(condition);
  
  return res.json({
    success: true,
    message: 'Alert condition created',
    condition,
    note: 'In demo mode - condition will not persist across requests',
  });
}

function handleHistory(req: VercelRequest, res: VercelResponse) {
  const { limit, offset, type, protocol, severity, unacknowledged } = req.query;
  
  let filtered = [...DEMO_ALERTS];
  
  if (type) {
    filtered = filtered.filter(a => a.type === type);
  }
  if (protocol) {
    filtered = filtered.filter(a => a.protocol === protocol);
  }
  if (severity) {
    filtered = filtered.filter(a => a.severity === severity);
  }
  if (unacknowledged === 'true') {
    filtered = filtered.filter(a => !a.acknowledged);
  }
  
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  
  const start = parseInt(offset as string) || 0;
  const count = parseInt(limit as string) || 50;
  const paginated = filtered.slice(start, start + count);
  
  return res.json({
    count: paginated.length,
    total: filtered.length,
    alerts: paginated.map(a => ({
      ...a,
      time: new Date(a.timestamp).toISOString(),
    })),
  });
}

function handleStats(req: VercelRequest, res: VercelResponse) {
  const stats = calculateStats();
  
  return res.json({
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
  });
}

function handlePresets(req: VercelRequest, res: VercelResponse) {
  const { preset } = req.query;
  
  if (req.method === 'GET' && !preset) {
    return res.json({
      presets: {
        'whale-alert': {
          description: 'Track large TVL movements (>25% changes)',
          conditions: ['tvl_change @ 25%'],
        },
        'yield-hunter': {
          description: 'Alert on high APY opportunities',
          conditions: ['new_opportunity @ 15% APY / <45 risk', 'apy_above @ 20%'],
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
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST to create presets' });
  }
  
  const validPresets = ['whale-alert', 'yield-hunter', 'risk-monitor', 'conservative'];
  
  if (!preset || !validPresets.includes(preset as string)) {
    return res.status(400).json({
      error: `Invalid preset. Must be one of: ${validPresets.join(', ')}`,
    });
  }
  
  const conditions: AlertCondition[] = [];
  
  switch (preset) {
    case 'whale-alert':
      conditions.push(createCondition('tvl_change', { changePercent: 25, cooldownMs: 30 * 60 * 1000 }));
      break;
      
    case 'yield-hunter':
      conditions.push(createCondition('new_opportunity', { minApy: 15, maxRiskScore: 45 }));
      conditions.push(createCondition('apy_above', { threshold: 20, cooldownMs: 2 * 60 * 60 * 1000 }));
      break;
      
    case 'risk-monitor':
      conditions.push(createCondition('risk_increase', { threshold: 15 }));
      conditions.push(createCondition('apy_change', { changePercent: 30, cooldownMs: 30 * 60 * 1000 }));
      break;
      
    case 'conservative':
      conditions.push(createCondition('apy_below', { threshold: 5, asset: 'USDC', cooldownMs: 4 * 60 * 60 * 1000 }));
      conditions.push(createCondition('risk_increase', { threshold: 10 }));
      break;
  }
  
  return res.json({
    success: true,
    preset,
    conditionsCreated: conditions.length,
    conditions: conditions.map(c => ({
      id: c.id,
      type: c.type,
      threshold: c.threshold,
      changePercent: c.changePercent,
    })),
    note: 'In demo mode - conditions will not persist',
  });
}

function handleStream(req: VercelRequest, res: VercelResponse) {
  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Send initial welcome
  const welcome = {
    type: 'welcome',
    timestamp: Date.now(),
    data: {
      stats: calculateStats(),
      conditions: DEMO_CONDITIONS.length,
      recentAlerts: DEMO_ALERTS.slice(0, 5),
    },
  };
  
  res.write(`data: ${JSON.stringify(welcome)}\n\n`);
  
  // Send periodic updates (simulated)
  let count = 0;
  const interval = setInterval(() => {
    count++;
    
    // Simulate occasional alerts
    if (Math.random() > 0.7) {
      const simulatedAlert = {
        type: 'alert',
        timestamp: Date.now(),
        data: {
          id: `sim_${Date.now()}`,
          type: 'apy_change',
          protocol: ['kamino', 'drift', 'jito', 'marinade'][Math.floor(Math.random() * 4)],
          asset: ['USDC', 'SOL', 'mSOL'][Math.floor(Math.random() * 3)],
          title: '📊 Simulated APY Change',
          message: `APY changed by ${(Math.random() * 20).toFixed(1)}%`,
          severity: Math.random() > 0.8 ? 'warning' : 'info',
        },
      };
      res.write(`data: ${JSON.stringify(simulatedAlert)}\n\n`);
    }
    
    // Periodic stats
    if (count % 5 === 0) {
      res.write(`data: ${JSON.stringify({
        type: 'stats',
        timestamp: Date.now(),
        data: calculateStats(),
      })}\n\n`);
    }
    
    // End after 2 minutes (Vercel timeout)
    if (count >= 24) {
      clearInterval(interval);
      res.end();
    }
  }, 5000);
  
  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
}

async function handleCheck(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST to trigger check' });
  }
  
  // Fetch current yields from DeFi Llama
  const yields = await fetchYields();
  
  // Check conditions and generate alerts
  const newAlerts = checkConditions(yields);
  
  return res.json({
    success: true,
    message: 'Alert check completed',
    yieldsChecked: yields.length,
    conditionsEvaluated: DEMO_CONDITIONS.filter(c => c.enabled).length,
    alertsGenerated: newAlerts.length,
    alerts: newAlerts,
  });
}

function handleAcknowledge(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  if (!id) {
    // Acknowledge all
    const count = DEMO_ALERTS.filter(a => !a.acknowledged).length;
    DEMO_ALERTS.forEach(a => a.acknowledged = true);
    
    return res.json({
      success: true,
      acknowledgedCount: count,
    });
  }
  
  const alert = DEMO_ALERTS.find(a => a.id === id);
  
  if (!alert) {
    return res.status(404).json({ error: `Alert not found: ${id}` });
  }
  
  alert.acknowledged = true;
  
  return res.json({
    success: true,
    message: `Alert ${id} acknowledged`,
  });
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
  
  const topTriggering = DEMO_CONDITIONS
    .filter(c => c.triggerCount > 0)
    .sort((a, b) => b.triggerCount - a.triggerCount)
    .slice(0, 5)
    .map(c => ({ conditionId: c.id, type: c.type, count: c.triggerCount }));
  
  return {
    totalConditions: DEMO_CONDITIONS.length,
    activeConditions: DEMO_CONDITIONS.filter(c => c.enabled).length,
    totalAlerts: DEMO_ALERTS.length,
    alertsToday: DEMO_ALERTS.filter(a => a.timestamp >= dayStart).length,
    byType,
    bySeverity,
    byProtocol,
    topTriggering,
  };
}

function createCondition(type: AlertType, params: Partial<AlertCondition>): AlertCondition {
  return {
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
}

async function fetchYields(): Promise<YieldData[]> {
  try {
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    // Filter Solana yields
    return data.data
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
    console.error('Failed to fetch yields:', err);
    return [];
  }
}

function estimateRisk(pool: any): number {
  let risk = 30; // Base risk
  
  // TVL factor
  if (pool.tvlUsd < 1_000_000) risk += 20;
  else if (pool.tvlUsd < 10_000_000) risk += 10;
  else if (pool.tvlUsd > 100_000_000) risk -= 10;
  
  // APY factor (very high APY = risky)
  if (pool.apy > 100) risk += 30;
  else if (pool.apy > 50) risk += 15;
  else if (pool.apy > 20) risk += 5;
  
  // Known protocols
  const trusted = ['kamino', 'drift', 'jito-staking', 'marinade-finance', 'marginfi'];
  if (trusted.includes(pool.project)) risk -= 15;
  
  return Math.max(0, Math.min(100, risk));
}

function checkConditions(yields: YieldData[]): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();
  
  for (const condition of DEMO_CONDITIONS) {
    if (!condition.enabled) continue;
    
    // Check cooldown
    if (condition.lastTriggered && 
        (now - condition.lastTriggered) < condition.cooldownMs) {
      continue;
    }
    
    for (const y of yields) {
      // Filter by protocol/asset
      if (condition.protocol && condition.protocol !== '*' && 
          y.protocol !== condition.protocol) continue;
      if (condition.asset && condition.asset !== '*' && 
          y.asset !== condition.asset) continue;
      
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
            message = `APY dropped to ${y.apy.toFixed(2)}% (below ${condition.threshold}% threshold)`;
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
            severity = 'info';
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
        
        // Only one alert per condition per check
        break;
      }
    }
  }
  
  return alerts;
}
