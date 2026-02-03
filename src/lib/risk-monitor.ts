/**
 * Real-Time Risk Scoring Monitor
 * 
 * Continuously monitors protocol risk levels and detects changes.
 * Think of it like a health monitor for your DeFi portfolio.
 * 
 * Key features:
 * - Continuous risk scoring (not just on-demand)
 * - Change detection with configurable sensitivity
 * - Alert generation for significant risk shifts
 * - Historical risk tracking for trend analysis
 * - Protocol health monitoring
 */

import { EventEmitter } from 'events';
import { YieldOpportunity } from '../types';
import { 
  RiskScore, 
  RiskAdjustedOpportunity,
  calculateRiskScore, 
  analyzeOpportunities,
  PROTOCOL_PROFILES 
} from './risk';
import { fetchSolanaYields } from './defillama';

// ============================================================================
// Types
// ============================================================================

export interface RiskSnapshot {
  timestamp: number;
  protocol: string;
  asset: string;
  riskScore: RiskScore;
  apy: number;
  tvl: number;
  adjustedApy: number;
}

export interface RiskChange {
  id: string;
  timestamp: number;
  protocol: string;
  asset: string;
  changeType: 'increase' | 'decrease' | 'stable';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  previousScore: number;
  currentScore: number;
  delta: number;
  deltaPercent: number;
  factors: {
    factor: string;
    previous: number;
    current: number;
    delta: number;
  }[];
  triggerReason: string;
  recommendation: string;
}

export interface RiskAlert {
  id: string;
  timestamp: number;
  alertType: 'risk_spike' | 'risk_drop' | 'tvl_crash' | 'apy_anomaly' | 'new_warning' | 'protocol_degradation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  protocol: string;
  asset?: string;
  title: string;
  description: string;
  actionRequired: boolean;
  suggestedAction?: string;
  data: Record<string, unknown>;
}

export interface ProtocolHealthStatus {
  protocol: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  lastCheck: number;
  avgRiskScore: number;
  riskTrend: 'improving' | 'stable' | 'worsening';
  activeAlerts: number;
  tvlTotal: number;
  poolCount: number;
}

export interface RiskMonitorConfig {
  pollIntervalMs: number;           // How often to check (default: 60s)
  changeThreshold: number;          // Min risk score change to trigger alert (default: 5)
  criticalThreshold: number;        // Risk score above this is critical (default: 70)
  tvlDropThreshold: number;         // % TVL drop to trigger alert (default: 0.2 = 20%)
  apyAnomalyThreshold: number;      // APY change % to trigger alert (default: 0.5 = 50%)
  historyRetentionMs: number;       // How long to keep history (default: 7 days)
  maxHistoryPerProtocol: number;    // Max snapshots per protocol (default: 1000)
}

export interface RiskMonitorState {
  isRunning: boolean;
  lastPollTime: number | null;
  pollCount: number;
  currentSnapshots: Map<string, RiskSnapshot>;
  alerts: RiskAlert[];
  changes: RiskChange[];
  protocolHealth: Map<string, ProtocolHealthStatus>;
}

// ============================================================================
// Risk Monitor Service
// ============================================================================

export class RiskMonitor extends EventEmitter {
  private config: RiskMonitorConfig;
  private state: RiskMonitorState;
  private pollTimer: NodeJS.Timeout | null = null;
  private history: Map<string, RiskSnapshot[]> = new Map();

  constructor(config: Partial<RiskMonitorConfig> = {}) {
    super();
    
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 60_000,
      changeThreshold: config.changeThreshold ?? 5,
      criticalThreshold: config.criticalThreshold ?? 70,
      tvlDropThreshold: config.tvlDropThreshold ?? 0.2,
      apyAnomalyThreshold: config.apyAnomalyThreshold ?? 0.5,
      historyRetentionMs: config.historyRetentionMs ?? 7 * 24 * 60 * 60 * 1000,
      maxHistoryPerProtocol: config.maxHistoryPerProtocol ?? 1000,
    };

    this.state = {
      isRunning: false,
      lastPollTime: null,
      pollCount: 0,
      currentSnapshots: new Map(),
      alerts: [],
      changes: [],
      protocolHealth: new Map(),
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async start(): Promise<void> {
    if (this.state.isRunning) return;
    
    this.state.isRunning = true;
    console.log('🔬 Risk Monitor started');
    this.emit('started');

    // Initial poll
    await this.poll();

    // Start polling
    this.pollTimer = setInterval(() => this.poll(), this.config.pollIntervalMs);
  }

  stop(): void {
    if (!this.state.isRunning) return;
    
    this.state.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('🔬 Risk Monitor stopped');
    this.emit('stopped');
  }

  // ============================================================================
  // Polling
  // ============================================================================

  private async poll(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Fetch current yields
      const yields = await fetchSolanaYields(50000);
      
      // Analyze with risk scoring
      const analyzed = analyzeOpportunities(yields);
      
      // Process each opportunity
      for (const opp of analyzed) {
        await this.processOpportunity(opp);
      }

      // Update protocol health
      this.updateProtocolHealth(analyzed);

      // Cleanup old history
      this.cleanupHistory();

      this.state.lastPollTime = startTime;
      this.state.pollCount++;

      this.emit('poll', {
        timestamp: startTime,
        duration: Date.now() - startTime,
        opportunitiesAnalyzed: analyzed.length,
        alertsGenerated: this.state.alerts.filter(a => a.timestamp > startTime).length,
      });

    } catch (err) {
      console.error('Risk Monitor poll error:', err);
      this.emit('error', err);
    }
  }

  private async processOpportunity(opp: RiskAdjustedOpportunity): Promise<void> {
    const key = `${opp.protocol}:${opp.asset}`;
    const now = Date.now();

    // Create snapshot
    const snapshot: RiskSnapshot = {
      timestamp: now,
      protocol: opp.protocol,
      asset: opp.asset,
      riskScore: opp.riskScore,
      apy: opp.apy,
      tvl: opp.tvl,
      adjustedApy: opp.adjustedApy,
    };

    // Get previous snapshot
    const previous = this.state.currentSnapshots.get(key);

    // Detect changes
    if (previous) {
      const change = this.detectChange(previous, snapshot);
      if (change) {
        this.state.changes.push(change);
        this.emit('change', change);

        // Generate alert if significant
        const alert = this.generateAlert(change, snapshot, previous);
        if (alert) {
          this.state.alerts.push(alert);
          this.emit('alert', alert);
        }
      }

      // Check for TVL crash
      if (previous.tvl > 0 && snapshot.tvl > 0) {
        const tvlDrop = (previous.tvl - snapshot.tvl) / previous.tvl;
        if (tvlDrop > this.config.tvlDropThreshold) {
          const alert = this.createTvlAlert(snapshot, previous, tvlDrop);
          this.state.alerts.push(alert);
          this.emit('alert', alert);
        }
      }

      // Check for APY anomaly
      if (previous.apy > 0) {
        const apyChange = Math.abs(snapshot.apy - previous.apy) / previous.apy;
        if (apyChange > this.config.apyAnomalyThreshold) {
          const alert = this.createApyAlert(snapshot, previous, apyChange);
          this.state.alerts.push(alert);
          this.emit('alert', alert);
        }
      }
    }

    // Update current snapshot
    this.state.currentSnapshots.set(key, snapshot);

    // Add to history
    let history = this.history.get(key) || [];
    history.push(snapshot);
    
    // Trim history
    if (history.length > this.config.maxHistoryPerProtocol) {
      history = history.slice(-this.config.maxHistoryPerProtocol);
    }
    this.history.set(key, history);

    this.emit('snapshot', snapshot);
  }

  // ============================================================================
  // Change Detection
  // ============================================================================

  private detectChange(previous: RiskSnapshot, current: RiskSnapshot): RiskChange | null {
    const delta = current.riskScore.overall - previous.riskScore.overall;
    const deltaPercent = previous.riskScore.overall > 0 
      ? (delta / previous.riskScore.overall) * 100 
      : 0;

    // Check if change is significant
    if (Math.abs(delta) < this.config.changeThreshold) {
      return null;
    }

    // Calculate factor changes
    const factorChanges: RiskChange['factors'] = [];
    const factors = ['smartContract', 'liquidity', 'sustainability', 'counterparty', 'assetVolatility'] as const;
    
    for (const factor of factors) {
      const prev = previous.riskScore.factors[factor];
      const curr = current.riskScore.factors[factor];
      if (Math.abs(curr - prev) >= 3) { // Factor changed by at least 3
        factorChanges.push({
          factor,
          previous: prev,
          current: curr,
          delta: curr - prev,
        });
      }
    }

    // Determine severity
    let severity: RiskChange['severity'];
    if (Math.abs(delta) >= 20 || current.riskScore.overall >= this.config.criticalThreshold) {
      severity = 'critical';
    } else if (Math.abs(delta) >= 15) {
      severity = 'high';
    } else if (Math.abs(delta) >= 10) {
      severity = 'medium';
    } else if (Math.abs(delta) >= this.config.changeThreshold) {
      severity = 'low';
    } else {
      severity = 'info';
    }

    // Determine trigger reason
    const triggerReason = this.determineTriggerReason(factorChanges, current);

    // Generate recommendation
    const recommendation = this.generateRecommendation(delta, current, severity);

    return {
      id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: current.timestamp,
      protocol: current.protocol,
      asset: current.asset,
      changeType: delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'stable',
      severity,
      previousScore: previous.riskScore.overall,
      currentScore: current.riskScore.overall,
      delta,
      deltaPercent,
      factors: factorChanges,
      triggerReason,
      recommendation,
    };
  }

  private determineTriggerReason(factorChanges: RiskChange['factors'], snapshot: RiskSnapshot): string {
    if (factorChanges.length === 0) {
      return 'Cumulative small changes across factors';
    }

    const primary = factorChanges.reduce((max, f) => 
      Math.abs(f.delta) > Math.abs(max.delta) ? f : max
    );

    const reasons: Record<string, string> = {
      smartContract: `Smart contract risk ${primary.delta > 0 ? 'increased' : 'decreased'} (audit/incident changes)`,
      liquidity: `Liquidity risk ${primary.delta > 0 ? 'increased' : 'improved'} (TVL change)`,
      sustainability: `APY sustainability concern ${primary.delta > 0 ? 'increased' : 'decreased'}`,
      counterparty: `Counterparty/centralization risk ${primary.delta > 0 ? 'increased' : 'decreased'}`,
      assetVolatility: `Asset volatility risk ${primary.delta > 0 ? 'increased' : 'decreased'}`,
    };

    return reasons[primary.factor] || 'Risk profile changed';
  }

  private generateRecommendation(delta: number, snapshot: RiskSnapshot, severity: RiskChange['severity']): string {
    if (delta > 0) {
      // Risk increased
      if (severity === 'critical') {
        return `URGENT: Consider immediate withdrawal from ${snapshot.protocol} ${snapshot.asset}. Risk score now ${snapshot.riskScore.overall}/100.`;
      } else if (severity === 'high') {
        return `Review exposure to ${snapshot.protocol} ${snapshot.asset}. Consider reducing position size.`;
      } else {
        return `Monitor ${snapshot.protocol} ${snapshot.asset} more closely. Risk has increased.`;
      }
    } else {
      // Risk decreased
      if (snapshot.riskScore.overall < 35) {
        return `${snapshot.protocol} ${snapshot.asset} now qualifies as low-risk. Consider as rebalancing target.`;
      } else {
        return `Risk profile improved for ${snapshot.protocol} ${snapshot.asset}.`;
      }
    }
  }

  // ============================================================================
  // Alert Generation
  // ============================================================================

  private generateAlert(change: RiskChange, current: RiskSnapshot, previous: RiskSnapshot): RiskAlert | null {
    // Only generate alerts for significant changes
    if (change.severity === 'info') return null;

    const isRiskIncrease = change.delta > 0;

    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: current.timestamp,
      alertType: isRiskIncrease ? 'risk_spike' : 'risk_drop',
      severity: change.severity as 'critical' | 'high' | 'medium' | 'low',
      protocol: current.protocol,
      asset: current.asset,
      title: isRiskIncrease 
        ? `⚠️ Risk Spike: ${current.protocol} ${current.asset}`
        : `📉 Risk Drop: ${current.protocol} ${current.asset}`,
      description: `Risk score ${isRiskIncrease ? 'increased' : 'decreased'} from ${previous.riskScore.overall} to ${current.riskScore.overall} (+${change.delta > 0 ? '' : ''}${change.delta}). ${change.triggerReason}`,
      actionRequired: change.severity === 'critical' || change.severity === 'high',
      suggestedAction: change.recommendation,
      data: {
        previousScore: previous.riskScore.overall,
        currentScore: current.riskScore.overall,
        delta: change.delta,
        deltaPercent: change.deltaPercent,
        factors: change.factors,
        warnings: current.riskScore.warnings,
      },
    };
  }

  private createTvlAlert(current: RiskSnapshot, previous: RiskSnapshot, drop: number): RiskAlert {
    const dropPercent = (drop * 100).toFixed(1);
    
    return {
      id: `alert-tvl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: current.timestamp,
      alertType: 'tvl_crash',
      severity: drop > 0.5 ? 'critical' : drop > 0.3 ? 'high' : 'medium',
      protocol: current.protocol,
      asset: current.asset,
      title: `🚨 TVL Drop: ${current.protocol} ${current.asset}`,
      description: `TVL dropped ${dropPercent}% from $${formatNumber(previous.tvl)} to $${formatNumber(current.tvl)}. This could indicate a bank run or liquidity crisis.`,
      actionRequired: drop > 0.3,
      suggestedAction: drop > 0.5 
        ? 'URGENT: Potential rug pull or crisis. Consider immediate withdrawal.'
        : 'Monitor closely. Large TVL drops often precede protocol issues.',
      data: {
        previousTvl: previous.tvl,
        currentTvl: current.tvl,
        dropPercent: drop * 100,
      },
    };
  }

  private createApyAlert(current: RiskSnapshot, previous: RiskSnapshot, change: number): RiskAlert {
    const changePercent = (change * 100).toFixed(1);
    const isIncrease = current.apy > previous.apy;

    return {
      id: `alert-apy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: current.timestamp,
      alertType: 'apy_anomaly',
      severity: change > 1 ? 'high' : 'medium',
      protocol: current.protocol,
      asset: current.asset,
      title: `📊 APY ${isIncrease ? 'Spike' : 'Drop'}: ${current.protocol} ${current.asset}`,
      description: `APY ${isIncrease ? 'increased' : 'decreased'} ${changePercent}% from ${previous.apy.toFixed(1)}% to ${current.apy.toFixed(1)}%.`,
      actionRequired: false,
      suggestedAction: isIncrease
        ? 'Investigate source of APY increase. Could indicate new incentives or decreased competition.'
        : 'APY decrease may indicate reduced incentives or increased competition.',
      data: {
        previousApy: previous.apy,
        currentApy: current.apy,
        changePercent: change * 100,
      },
    };
  }

  // ============================================================================
  // Protocol Health
  // ============================================================================

  private updateProtocolHealth(opportunities: RiskAdjustedOpportunity[]): void {
    // Group by protocol
    const byProtocol = new Map<string, RiskAdjustedOpportunity[]>();
    for (const opp of opportunities) {
      const existing = byProtocol.get(opp.protocol) || [];
      existing.push(opp);
      byProtocol.set(opp.protocol, existing);
    }

    // Calculate health for each protocol
    for (const [protocol, opps] of byProtocol) {
      const avgRisk = opps.reduce((sum, o) => sum + o.riskScore.overall, 0) / opps.length;
      const totalTvl = opps.reduce((sum, o) => sum + o.tvl, 0);
      const activeAlerts = this.state.alerts.filter(
        a => a.protocol === protocol && Date.now() - a.timestamp < 3600000 // Last hour
      ).length;

      // Determine trend by comparing to historical average
      const histories = opps.flatMap(o => {
        const key = `${o.protocol}:${o.asset}`;
        return this.history.get(key) || [];
      });
      
      let riskTrend: 'improving' | 'stable' | 'worsening' = 'stable';
      if (histories.length >= 10) {
        const recent = histories.slice(-5);
        const older = histories.slice(-10, -5);
        const recentAvg = recent.reduce((s, h) => s + h.riskScore.overall, 0) / recent.length;
        const olderAvg = older.reduce((s, h) => s + h.riskScore.overall, 0) / older.length;
        
        if (recentAvg < olderAvg - 3) riskTrend = 'improving';
        else if (recentAvg > olderAvg + 3) riskTrend = 'worsening';
      }

      // Determine status
      let status: ProtocolHealthStatus['status'] = 'healthy';
      if (avgRisk >= this.config.criticalThreshold || activeAlerts >= 3) {
        status = 'critical';
      } else if (avgRisk >= 50 || activeAlerts >= 1) {
        status = 'degraded';
      }

      const health: ProtocolHealthStatus = {
        protocol,
        status,
        lastCheck: Date.now(),
        avgRiskScore: Math.round(avgRisk),
        riskTrend,
        activeAlerts,
        tvlTotal: totalTvl,
        poolCount: opps.length,
      };

      this.state.protocolHealth.set(protocol, health);
      this.emit('healthUpdate', health);
    }
  }

  // ============================================================================
  // History Management
  // ============================================================================

  private cleanupHistory(): void {
    const cutoff = Date.now() - this.config.historyRetentionMs;
    
    for (const [key, snapshots] of this.history) {
      const filtered = snapshots.filter(s => s.timestamp > cutoff);
      if (filtered.length === 0) {
        this.history.delete(key);
      } else {
        this.history.set(key, filtered);
      }
    }

    // Also cleanup old alerts and changes (keep last 24h)
    const alertCutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.state.alerts = this.state.alerts.filter(a => a.timestamp > alertCutoff);
    this.state.changes = this.state.changes.filter(c => c.timestamp > alertCutoff);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getState(): RiskMonitorState {
    return {
      ...this.state,
      currentSnapshots: new Map(this.state.currentSnapshots),
      protocolHealth: new Map(this.state.protocolHealth),
    };
  }

  getConfig(): RiskMonitorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RiskMonitorConfig>): void {
    Object.assign(this.config, updates);
    this.emit('configUpdate', this.config);
  }

  getCurrentRisk(protocol: string, asset?: string): RiskSnapshot | null {
    if (asset) {
      return this.state.currentSnapshots.get(`${protocol}:${asset}`) || null;
    }
    
    // Return first match for protocol
    for (const [key, snapshot] of this.state.currentSnapshots) {
      if (key.startsWith(`${protocol}:`)) {
        return snapshot;
      }
    }
    return null;
  }

  getAllCurrentRisks(): RiskSnapshot[] {
    return Array.from(this.state.currentSnapshots.values());
  }

  getProtocolHealth(protocol: string): ProtocolHealthStatus | null {
    return this.state.protocolHealth.get(protocol) || null;
  }

  getAllProtocolHealth(): ProtocolHealthStatus[] {
    return Array.from(this.state.protocolHealth.values());
  }

  getRecentAlerts(limit: number = 20): RiskAlert[] {
    return this.state.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getRecentChanges(limit: number = 20): RiskChange[] {
    return this.state.changes
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getHistory(protocol: string, asset: string, limit?: number): RiskSnapshot[] {
    const key = `${protocol}:${asset}`;
    const history = this.history.get(key) || [];
    return limit ? history.slice(-limit) : history;
  }

  getRiskTrend(protocol: string, asset: string, windowMs: number = 3600000): {
    trend: 'improving' | 'stable' | 'worsening';
    startScore: number;
    endScore: number;
    delta: number;
  } | null {
    const history = this.getHistory(protocol, asset);
    if (history.length < 2) return null;

    const cutoff = Date.now() - windowMs;
    const recent = history.filter(h => h.timestamp > cutoff);
    if (recent.length < 2) return null;

    const startScore = recent[0].riskScore.overall;
    const endScore = recent[recent.length - 1].riskScore.overall;
    const delta = endScore - startScore;

    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (delta < -3) trend = 'improving';
    else if (delta > 3) trend = 'worsening';

    return { trend, startScore, endScore, delta };
  }

  // Force immediate poll (useful for testing)
  async forcePoll(): Promise<void> {
    await this.poll();
  }

  // Get summary for display
  getSummary(): {
    status: string;
    lastPoll: string;
    protocolsMonitored: number;
    poolsMonitored: number;
    activeAlerts: number;
    criticalAlerts: number;
    healthyProtocols: number;
    degradedProtocols: number;
  } {
    const health = Array.from(this.state.protocolHealth.values());
    const criticalAlerts = this.state.alerts.filter(
      a => a.severity === 'critical' && Date.now() - a.timestamp < 3600000
    ).length;

    return {
      status: this.state.isRunning ? 'running' : 'stopped',
      lastPoll: this.state.lastPollTime 
        ? new Date(this.state.lastPollTime).toISOString() 
        : 'never',
      protocolsMonitored: this.state.protocolHealth.size,
      poolsMonitored: this.state.currentSnapshots.size,
      activeAlerts: this.state.alerts.filter(a => Date.now() - a.timestamp < 3600000).length,
      criticalAlerts,
      healthyProtocols: health.filter(h => h.status === 'healthy').length,
      degradedProtocols: health.filter(h => h.status === 'degraded' || h.status === 'critical').length,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitorInstance: RiskMonitor | null = null;

export function getRiskMonitor(config?: Partial<RiskMonitorConfig>): RiskMonitor {
  if (!monitorInstance) {
    monitorInstance = new RiskMonitor(config);
  }
  return monitorInstance;
}

// ============================================================================
// Utilities
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}
