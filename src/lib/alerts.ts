/**
 * Real-time Yield Alert System
 * 
 * A sophisticated alerting engine that monitors Solana DeFi yields and notifies
 * users when conditions are met. Think TradingView alerts but for DeFi yields.
 * 
 * Alert Types:
 * - APY threshold (above/below)
 * - APY change (sudden drops/spikes)
 * - TVL change (liquidity shifts)
 * - Risk score change
 * - New opportunity discovery
 * - Protocol-specific alerts
 * 
 * Features:
 * - In-memory + file persistence
 * - Deduplication (don't spam)
 * - Cooldown periods
 * - Webhook delivery
 * - SSE real-time streaming
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { YieldOpportunity } from '../types';
import { RiskAnalyzedYield } from './risk';

// ============================================================================
// Types
// ============================================================================

export type AlertType = 
  | 'apy_above'       // APY rises above threshold
  | 'apy_below'       // APY drops below threshold  
  | 'apy_change'      // APY changes by X% from baseline
  | 'tvl_change'      // TVL changes significantly
  | 'risk_increase'   // Risk score increases
  | 'risk_decrease'   // Risk score decreases
  | 'new_opportunity' // New high-yield opportunity appears
  | 'protocol_event'; // Protocol-specific (e.g., reward changes)

export interface AlertCondition {
  id: string;
  type: AlertType;
  enabled: boolean;
  createdAt: number;
  
  // Target filters
  protocol?: string;        // e.g., 'kamino', 'drift', or '*' for all
  asset?: string;           // e.g., 'USDC', 'SOL', or '*' for all
  
  // Thresholds
  threshold?: number;       // For apy_above/below/change
  changePercent?: number;   // For change-based alerts (e.g., 10 = 10% change)
  minApy?: number;          // For new_opportunity (minimum APY to alert)
  maxRiskScore?: number;    // Filter by risk
  
  // Delivery
  cooldownMs: number;       // Minimum time between alerts (default: 1 hour)
  webhook?: string;         // Optional webhook URL for delivery
  
  // State
  lastTriggered?: number;
  triggerCount: number;
  baseline?: number;        // For change tracking
}

export interface Alert {
  id: string;
  conditionId: string;
  type: AlertType;
  timestamp: number;
  
  // Context
  protocol: string;
  asset: string;
  currentValue: number;
  previousValue?: number;
  threshold?: number;
  changePercent?: number;
  
  // Risk info
  riskScore?: number;
  tvl?: number;
  
  // Human readable
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  
  // State
  acknowledged: boolean;
  acknowledgedAt?: number;
  deliveredVia: string[];
}

export interface AlertStats {
  totalConditions: number;
  activeConditions: number;
  totalAlerts: number;
  alertsToday: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<string, number>;
  byProtocol: Record<string, number>;
  topTriggering: Array<{ conditionId: string; count: number }>;
}

export interface YieldSnapshot {
  timestamp: number;
  yields: Map<string, { apy: number; tvl: number; risk?: number }>;
}

// ============================================================================
// Alert Engine
// ============================================================================

export class AlertEngine extends EventEmitter {
  private conditions: Map<string, AlertCondition> = new Map();
  private alerts: Alert[] = [];
  private dataDir: string;
  private snapshot: YieldSnapshot | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor(dataDir: string = './data/alerts') {
    super();
    this.dataDir = dataDir;
    this.ensureDataDir();
    this.loadState();
  }
  
  // ============================================================================
  // Condition Management
  // ============================================================================
  
  /**
   * Create a new alert condition
   */
  createCondition(params: Omit<AlertCondition, 'id' | 'createdAt' | 'triggerCount'>): AlertCondition {
    const condition: AlertCondition = {
      ...params,
      id: this.generateId('cond'),
      createdAt: Date.now(),
      triggerCount: 0,
      cooldownMs: params.cooldownMs || 60 * 60 * 1000, // 1 hour default
    };
    
    this.conditions.set(condition.id, condition);
    this.saveConditions();
    
    this.emit('condition:created', condition);
    console.log(`📢 Alert condition created: ${condition.id} (${condition.type})`);
    
    return condition;
  }
  
  /**
   * Update an existing condition
   */
  updateCondition(id: string, updates: Partial<AlertCondition>): AlertCondition | null {
    const condition = this.conditions.get(id);
    if (!condition) return null;
    
    const updated = { ...condition, ...updates, id: condition.id };
    this.conditions.set(id, updated);
    this.saveConditions();
    
    this.emit('condition:updated', updated);
    return updated;
  }
  
  /**
   * Delete a condition
   */
  deleteCondition(id: string): boolean {
    const deleted = this.conditions.delete(id);
    if (deleted) {
      this.saveConditions();
      this.emit('condition:deleted', { id });
    }
    return deleted;
  }
  
  /**
   * Get all conditions
   */
  getConditions(): AlertCondition[] {
    return Array.from(this.conditions.values());
  }
  
  /**
   * Get a specific condition
   */
  getCondition(id: string): AlertCondition | undefined {
    return this.conditions.get(id);
  }
  
  // ============================================================================
  // Alert Processing
  // ============================================================================
  
  /**
   * Process yield data and check all conditions
   */
  async processYields(yields: RiskAnalyzedYield[]): Promise<Alert[]> {
    const newAlerts: Alert[] = [];
    const now = Date.now();
    
    // Build current snapshot
    const currentSnapshot: YieldSnapshot = {
      timestamp: now,
      yields: new Map(),
    };
    
    for (const y of yields) {
      const key = `${y.protocol}:${y.asset}`;
      currentSnapshot.yields.set(key, {
        apy: y.apy,
        tvl: y.tvl,
        risk: y.riskScore?.overall,
      });
    }
    
    // Check each condition
    for (const condition of this.conditions.values()) {
      if (!condition.enabled) continue;
      
      // Check cooldown
      if (condition.lastTriggered && 
          (now - condition.lastTriggered) < condition.cooldownMs) {
        continue;
      }
      
      const triggeredAlerts = this.checkCondition(condition, yields, currentSnapshot);
      
      for (const alert of triggeredAlerts) {
        this.alerts.push(alert);
        newAlerts.push(alert);
        
        // Update condition state
        condition.lastTriggered = now;
        condition.triggerCount++;
        
        // Emit event
        this.emit('alert', alert);
        
        // Deliver via webhook if configured
        if (condition.webhook) {
          this.deliverWebhook(condition.webhook, alert).catch(err => {
            console.error(`Webhook delivery failed: ${err}`);
          });
        }
      }
    }
    
    // Update snapshot for next comparison
    this.snapshot = currentSnapshot;
    
    // Save state
    if (newAlerts.length > 0) {
      this.saveAlerts();
      this.saveConditions();
    }
    
    return newAlerts;
  }
  
  /**
   * Check a single condition against yields
   */
  private checkCondition(
    condition: AlertCondition,
    yields: RiskAnalyzedYield[],
    currentSnapshot: YieldSnapshot
  ): Alert[] {
    const alerts: Alert[] = [];
    
    // Filter yields by protocol/asset
    const relevantYields = yields.filter(y => {
      if (condition.protocol && condition.protocol !== '*' && 
          y.protocol !== condition.protocol) {
        return false;
      }
      if (condition.asset && condition.asset !== '*' && 
          y.asset !== condition.asset) {
        return false;
      }
      return true;
    });
    
    for (const yield_ of relevantYields) {
      const key = `${yield_.protocol}:${yield_.asset}`;
      const previous = this.snapshot?.yields.get(key);
      
      let triggered = false;
      let title = '';
      let message = '';
      let severity: 'info' | 'warning' | 'critical' = 'info';
      let changePercent: number | undefined;
      
      switch (condition.type) {
        case 'apy_above':
          if (yield_.apy >= (condition.threshold || 0)) {
            triggered = true;
            title = `🚀 APY Alert: ${yield_.protocol} ${yield_.asset}`;
            message = `APY is now ${yield_.apy.toFixed(2)}% (above ${condition.threshold}% threshold)`;
            severity = yield_.apy > (condition.threshold || 0) * 1.5 ? 'warning' : 'info';
          }
          break;
          
        case 'apy_below':
          if (yield_.apy <= (condition.threshold || 0)) {
            triggered = true;
            title = `⚠️ APY Drop: ${yield_.protocol} ${yield_.asset}`;
            message = `APY dropped to ${yield_.apy.toFixed(2)}% (below ${condition.threshold}% threshold)`;
            severity = 'warning';
          }
          break;
          
        case 'apy_change':
          if (previous) {
            const change = ((yield_.apy - previous.apy) / previous.apy) * 100;
            changePercent = change;
            
            if (Math.abs(change) >= (condition.changePercent || 10)) {
              triggered = true;
              const direction = change > 0 ? '📈' : '📉';
              title = `${direction} APY Change: ${yield_.protocol} ${yield_.asset}`;
              message = `APY changed ${change > 0 ? '+' : ''}${change.toFixed(1)}% (${previous.apy.toFixed(2)}% → ${yield_.apy.toFixed(2)}%)`;
              severity = Math.abs(change) > 25 ? 'critical' : 'warning';
            }
          }
          break;
          
        case 'tvl_change':
          if (previous && previous.tvl > 0) {
            const change = ((yield_.tvl - previous.tvl) / previous.tvl) * 100;
            changePercent = change;
            
            if (Math.abs(change) >= (condition.changePercent || 20)) {
              triggered = true;
              const direction = change > 0 ? '💰' : '🏃';
              title = `${direction} TVL Change: ${yield_.protocol} ${yield_.asset}`;
              message = `TVL changed ${change > 0 ? '+' : ''}${change.toFixed(1)}% ($${formatTVL(previous.tvl)} → $${formatTVL(yield_.tvl)})`;
              severity = change < -30 ? 'critical' : 'warning';
            }
          }
          break;
          
        case 'risk_increase':
          if (previous?.risk && yield_.riskScore) {
            const riskIncrease = yield_.riskScore.overall - previous.risk;
            
            if (riskIncrease >= (condition.threshold || 10)) {
              triggered = true;
              title = `🔴 Risk Increase: ${yield_.protocol} ${yield_.asset}`;
              message = `Risk score increased by ${riskIncrease.toFixed(0)} points (${previous.risk} → ${yield_.riskScore.overall})`;
              severity = riskIncrease > 20 ? 'critical' : 'warning';
            }
          }
          break;
          
        case 'risk_decrease':
          if (previous?.risk && yield_.riskScore) {
            const riskDecrease = previous.risk - yield_.riskScore.overall;
            
            if (riskDecrease >= (condition.threshold || 10)) {
              triggered = true;
              title = `🟢 Risk Decrease: ${yield_.protocol} ${yield_.asset}`;
              message = `Risk score decreased by ${riskDecrease.toFixed(0)} points (${previous.risk} → ${yield_.riskScore.overall})`;
              severity = 'info';
            }
          }
          break;
          
        case 'new_opportunity':
          // Check if this is a new yield we haven't seen before
          if (!this.snapshot?.yields.has(key)) {
            const minApy = condition.minApy || 10;
            const maxRisk = condition.maxRiskScore || 50;
            
            if (yield_.apy >= minApy && 
                (!yield_.riskScore || yield_.riskScore.overall <= maxRisk)) {
              triggered = true;
              title = `✨ New Opportunity: ${yield_.protocol} ${yield_.asset}`;
              message = `New yield discovered: ${yield_.apy.toFixed(2)}% APY, ${yield_.riskScore?.overall || 'N/A'} risk score, $${formatTVL(yield_.tvl)} TVL`;
              severity = yield_.apy > 20 ? 'warning' : 'info';
            }
          }
          break;
      }
      
      if (triggered) {
        alerts.push({
          id: this.generateId('alert'),
          conditionId: condition.id,
          type: condition.type,
          timestamp: Date.now(),
          protocol: yield_.protocol,
          asset: yield_.asset,
          currentValue: yield_.apy,
          previousValue: previous?.apy,
          threshold: condition.threshold,
          changePercent,
          riskScore: yield_.riskScore?.overall,
          tvl: yield_.tvl,
          title,
          message,
          severity,
          acknowledged: false,
          deliveredVia: ['sse'],
        });
      }
    }
    
    return alerts;
  }
  
  // ============================================================================
  // Alert History & State
  // ============================================================================
  
  /**
   * Get recent alerts
   */
  getAlerts(options: {
    limit?: number;
    offset?: number;
    type?: AlertType;
    protocol?: string;
    severity?: string;
    unacknowledgedOnly?: boolean;
    since?: number;
  } = {}): Alert[] {
    let filtered = [...this.alerts];
    
    if (options.type) {
      filtered = filtered.filter(a => a.type === options.type);
    }
    if (options.protocol) {
      filtered = filtered.filter(a => a.protocol === options.protocol);
    }
    if (options.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }
    if (options.unacknowledgedOnly) {
      filtered = filtered.filter(a => !a.acknowledged);
    }
    if (options.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since);
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    
    return filtered.slice(offset, offset + limit);
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();
    this.saveAlerts();
    
    this.emit('alert:acknowledged', alert);
    return true;
  }
  
  /**
   * Acknowledge all alerts
   */
  acknowledgeAll(): number {
    const now = Date.now();
    let count = 0;
    
    for (const alert of this.alerts) {
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        alert.acknowledgedAt = now;
        count++;
      }
    }
    
    if (count > 0) {
      this.saveAlerts();
      this.emit('alerts:acknowledged', { count });
    }
    
    return count;
  }
  
  /**
   * Get alert statistics
   */
  getStats(): AlertStats {
    const now = Date.now();
    const dayStart = now - 24 * 60 * 60 * 1000;
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};
    
    for (const alert of this.alerts) {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      byProtocol[alert.protocol] = (byProtocol[alert.protocol] || 0) + 1;
    }
    
    const conditions = Array.from(this.conditions.values());
    const topTriggering = conditions
      .filter(c => c.triggerCount > 0)
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 5)
      .map(c => ({ conditionId: c.id, count: c.triggerCount }));
    
    return {
      totalConditions: conditions.length,
      activeConditions: conditions.filter(c => c.enabled).length,
      totalAlerts: this.alerts.length,
      alertsToday: this.alerts.filter(a => a.timestamp >= dayStart).length,
      byType: byType as Record<AlertType, number>,
      bySeverity,
      byProtocol,
      topTriggering,
    };
  }
  
  // ============================================================================
  // Webhook Delivery
  // ============================================================================
  
  /**
   * Deliver alert via webhook
   */
  private async deliverWebhook(url: string, alert: Alert): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SolanaYield-AlertEngine/1.0',
        },
        body: JSON.stringify({
          event: 'yield_alert',
          timestamp: new Date(alert.timestamp).toISOString(),
          alert,
        }),
      });
      
      if (!response.ok) {
        console.error(`Webhook failed (${response.status}): ${await response.text()}`);
      } else {
        alert.deliveredVia.push('webhook');
        console.log(`✅ Webhook delivered: ${alert.id} → ${url}`);
      }
    } catch (err) {
      console.error(`Webhook error: ${err}`);
    }
  }
  
  // ============================================================================
  // Preset Alert Templates
  // ============================================================================
  
  /**
   * Create common alert presets
   */
  createPreset(preset: 'whale-alert' | 'yield-hunter' | 'risk-monitor' | 'conservative'): AlertCondition[] {
    const conditions: AlertCondition[] = [];
    
    switch (preset) {
      case 'whale-alert':
        // Track large TVL movements
        conditions.push(this.createCondition({
          type: 'tvl_change',
          enabled: true,
          protocol: '*',
          asset: '*',
          changePercent: 25,
          cooldownMs: 30 * 60 * 1000, // 30 min
        }));
        break;
        
      case 'yield-hunter':
        // Alert on high APY opportunities
        conditions.push(this.createCondition({
          type: 'new_opportunity',
          enabled: true,
          protocol: '*',
          asset: '*',
          minApy: 15,
          maxRiskScore: 45,
          cooldownMs: 60 * 60 * 1000, // 1 hour
        }));
        conditions.push(this.createCondition({
          type: 'apy_above',
          enabled: true,
          protocol: '*',
          asset: '*',
          threshold: 20,
          cooldownMs: 2 * 60 * 60 * 1000, // 2 hours
        }));
        break;
        
      case 'risk-monitor':
        // Track risk changes
        conditions.push(this.createCondition({
          type: 'risk_increase',
          enabled: true,
          protocol: '*',
          asset: '*',
          threshold: 15,
          cooldownMs: 60 * 60 * 1000,
        }));
        conditions.push(this.createCondition({
          type: 'apy_change',
          enabled: true,
          protocol: '*',
          asset: '*',
          changePercent: 30,
          cooldownMs: 30 * 60 * 1000,
        }));
        break;
        
      case 'conservative':
        // Stablecoin-focused, low-risk alerts
        conditions.push(this.createCondition({
          type: 'apy_below',
          enabled: true,
          protocol: '*',
          asset: 'USDC',
          threshold: 5,
          cooldownMs: 4 * 60 * 60 * 1000,
        }));
        conditions.push(this.createCondition({
          type: 'risk_increase',
          enabled: true,
          protocol: '*',
          asset: '*',
          threshold: 10,
          cooldownMs: 60 * 60 * 1000,
        }));
        break;
    }
    
    return conditions;
  }
  
  // ============================================================================
  // Persistence
  // ============================================================================
  
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  private loadState(): void {
    try {
      const conditionsPath = path.join(this.dataDir, 'conditions.json');
      if (fs.existsSync(conditionsPath)) {
        const data = JSON.parse(fs.readFileSync(conditionsPath, 'utf-8'));
        this.conditions = new Map(data.map((c: AlertCondition) => [c.id, c]));
        console.log(`📢 Loaded ${this.conditions.size} alert conditions`);
      }
    } catch (err) {
      console.warn(`Failed to load conditions: ${err}`);
    }
    
    try {
      const alertsPath = path.join(this.dataDir, 'alerts.json');
      if (fs.existsSync(alertsPath)) {
        const data = JSON.parse(fs.readFileSync(alertsPath, 'utf-8'));
        this.alerts = data.slice(-1000); // Keep last 1000 alerts
        console.log(`📢 Loaded ${this.alerts.length} alerts`);
      }
    } catch (err) {
      console.warn(`Failed to load alerts: ${err}`);
    }
    
    try {
      const snapshotPath = path.join(this.dataDir, 'snapshot.json');
      if (fs.existsSync(snapshotPath)) {
        const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
        this.snapshot = {
          timestamp: data.timestamp,
          yields: new Map(Object.entries(data.yields)),
        };
      }
    } catch (err) {
      // Snapshot is optional
    }
  }
  
  private saveConditions(): void {
    try {
      const conditionsPath = path.join(this.dataDir, 'conditions.json');
      const data = Array.from(this.conditions.values());
      fs.writeFileSync(conditionsPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Failed to save conditions: ${err}`);
    }
  }
  
  private saveAlerts(): void {
    try {
      const alertsPath = path.join(this.dataDir, 'alerts.json');
      // Keep only last 1000 alerts
      const recentAlerts = this.alerts.slice(-1000);
      fs.writeFileSync(alertsPath, JSON.stringify(recentAlerts, null, 2));
    } catch (err) {
      console.error(`Failed to save alerts: ${err}`);
    }
    
    // Also save snapshot
    if (this.snapshot) {
      try {
        const snapshotPath = path.join(this.dataDir, 'snapshot.json');
        const data = {
          timestamp: this.snapshot.timestamp,
          yields: Object.fromEntries(this.snapshot.yields),
        };
        fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2));
      } catch (err) {
        // Non-critical
      }
    }
  }
  
  // ============================================================================
  // Utilities
  // ============================================================================
  
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.conditions.clear();
    this.alerts = [];
    this.snapshot = null;
    this.saveConditions();
    this.saveAlerts();
  }
}

// ============================================================================
// SSE Alert Stream Server
// ============================================================================

import { IncomingMessage, ServerResponse } from 'http';

export class AlertStreamServer {
  private clients: Map<string, ServerResponse> = new Map();
  private alertEngine: AlertEngine;
  
  constructor(alertEngine: AlertEngine) {
    this.alertEngine = alertEngine;
    
    // Forward alerts to all connected clients
    alertEngine.on('alert', (alert: Alert) => {
      this.broadcast({
        type: 'alert',
        timestamp: Date.now(),
        data: alert,
      });
    });
    
    alertEngine.on('condition:created', (condition: AlertCondition) => {
      this.broadcast({
        type: 'condition:created',
        timestamp: Date.now(),
        data: condition,
      });
    });
    
    alertEngine.on('condition:updated', (condition: AlertCondition) => {
      this.broadcast({
        type: 'condition:updated',
        timestamp: Date.now(),
        data: condition,
      });
    });
    
    // Periodic stats broadcast
    setInterval(() => this.broadcastStats(), 60000);
  }
  
  /**
   * Handle SSE connection
   */
  handleConnection(req: IncomingMessage, res: ServerResponse): void {
    const clientId = `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    
    this.clients.set(clientId, res);
    
    // Send welcome with current stats
    this.sendToClient(res, {
      type: 'welcome',
      timestamp: Date.now(),
      data: {
        clientId,
        stats: this.alertEngine.getStats(),
        conditions: this.alertEngine.getConditions(),
        recentAlerts: this.alertEngine.getAlerts({ limit: 10 }),
      },
    });
    
    console.log(`🔔 Alert stream client connected: ${clientId} (total: ${this.clients.size})`);
    
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`🔔 Alert stream client disconnected: ${clientId} (total: ${this.clients.size})`);
    });
  }
  
  private sendToClient(res: ServerResponse, data: unknown): void {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Client disconnected
    }
  }
  
  private broadcast(data: unknown): void {
    for (const res of this.clients.values()) {
      this.sendToClient(res, data);
    }
  }
  
  private broadcastStats(): void {
    if (this.clients.size === 0) return;
    
    this.broadcast({
      type: 'stats',
      timestamp: Date.now(),
      data: this.alertEngine.getStats(),
    });
  }
  
  getClientCount(): number {
    return this.clients.size;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatTVL(tvl: number): string {
  if (tvl >= 1_000_000_000) return `${(tvl / 1_000_000_000).toFixed(2)}B`;
  if (tvl >= 1_000_000) return `${(tvl / 1_000_000).toFixed(2)}M`;
  if (tvl >= 1_000) return `${(tvl / 1_000).toFixed(2)}K`;
  return tvl.toFixed(2);
}

// ============================================================================
// Export singleton for convenience
// ============================================================================

let alertEngineInstance: AlertEngine | null = null;
let alertStreamInstance: AlertStreamServer | null = null;

export function getAlertEngine(dataDir?: string): AlertEngine {
  if (!alertEngineInstance) {
    alertEngineInstance = new AlertEngine(dataDir);
  }
  return alertEngineInstance;
}

export function getAlertStream(): AlertStreamServer {
  if (!alertStreamInstance) {
    alertStreamInstance = new AlertStreamServer(getAlertEngine());
  }
  return alertStreamInstance;
}
