/**
 * Decision History & Audit Trail System
 * 
 * Provides complete transparency into every decision the agent makes.
 * Critical for:
 * - Regulatory compliance (audit trail)
 * - User trust (see exactly why decisions were made)
 * - Debugging (replay decision contexts)
 * - Learning (analyze decision patterns)
 * 
 * Storage: File-based JSON (one file per day for easy archival)
 * Query: In-memory index for fast lookups
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { AutopilotDecision } from './autopilot';
import { YieldOpportunity, Portfolio, Strategy } from '../types';
import { RiskAdjustedOpportunity } from './risk';

// ============================================================================
// Types
// ============================================================================

export interface DecisionRecord {
  id: string;                          // Unique identifier (timestamp + hash)
  decision: AutopilotDecision;         // The actual decision
  context: DecisionContext;            // Full context at decision time
  meta: DecisionMeta;                  // Metadata for querying
}

export interface DecisionContext {
  timestamp: number;
  portfolioSnapshot: Portfolio;        // Portfolio state at decision time
  yieldSnapshot: YieldOpportunity[];   // Top yields available
  riskAnalyzedYields: RiskAdjustedOpportunity[]; // Risk-analyzed yields
  strategyConfig: Strategy;            // Active strategy
  marketConditions?: {
    solPrice?: number;
    totalSolanaTvl?: number;
    avgApy?: number;
  };
  // Live Trading Mode context
  tradingMode?: 'manual' | 'monitoring' | 'autonomous';
  sessionId?: string;
}

export interface DecisionMeta {
  date: string;                        // YYYY-MM-DD for grouping
  decisionType: 'hold' | 'rebalance' | 'enter' | 'exit';
  protocols: string[];                 // Protocols involved
  assets: string[];                    // Assets involved
  confidence: number;
  executed: boolean;
  hasError: boolean;
  riskChange: 'increased' | 'decreased' | 'unchanged' | null;
  apyImpact: number;                   // Projected APY change
}

export interface DecisionQuery {
  startTime?: number;
  endTime?: number;
  types?: ('hold' | 'rebalance' | 'enter' | 'exit')[];
  protocols?: string[];
  assets?: string[];
  minConfidence?: number;
  executedOnly?: boolean;
  withErrors?: boolean;
  limit?: number;
  offset?: number;
}

export interface DecisionStats {
  totalDecisions: number;
  byType: Record<string, number>;
  byProtocol: Record<string, number>;
  executionRate: number;
  avgConfidence: number;
  riskChanges: {
    increased: number;
    decreased: number;
    unchanged: number;
  };
  totalApyGained: number;
  errorRate: number;
  timeRange: {
    first: number | null;
    last: number | null;
  };
}

export interface AuditExport {
  exportedAt: string;
  version: string;
  totalRecords: number;
  dateRange: { start: string; end: string };
  records: DecisionRecord[];
  statistics: DecisionStats;
  checksums: {
    recordCount: number;
    firstId: string;
    lastId: string;
  };
}

// ============================================================================
// Decision History Store
// ============================================================================

export class DecisionHistoryStore {
  private dataDir: string;
  private index: Map<string, DecisionMeta & { filePath: string }> = new Map();
  private cache: Map<string, DecisionRecord> = new Map();
  private maxCacheSize = 100;

  constructor(dataDir: string = './data/decisions') {
    this.dataDir = dataDir;
    this.ensureDataDir();
    this.buildIndex();
  }

  /**
   * Record a new decision with full context
   */
  async record(
    decision: AutopilotDecision,
    context: Omit<DecisionContext, 'timestamp'>
  ): Promise<DecisionRecord> {
    const timestamp = decision.timestamp;
    const id = this.generateId(timestamp);
    const date = new Date(timestamp).toISOString().split('T')[0];
    
    // Extract metadata for fast querying
    const meta: DecisionMeta = {
      date,
      decisionType: decision.type,
      protocols: this.extractProtocols(decision),
      assets: this.extractAssets(decision),
      confidence: decision.confidence,
      executed: decision.executed,
      hasError: !!decision.error,
      riskChange: decision.riskAnalysis?.riskChange || null,
      apyImpact: this.calculateApyImpact(decision),
    };

    const record: DecisionRecord = {
      id,
      decision,
      context: { ...context, timestamp },
      meta,
    };

    // Save to file
    this.saveToFile(record, date);
    
    // Update index
    const filePath = this.getFilePath(date);
    this.index.set(id, { ...meta, filePath });
    
    // Update cache
    this.updateCache(record);

    return record;
  }

  /**
   * Get a specific decision by ID
   */
  async get(id: string): Promise<DecisionRecord | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Look up in index
    const meta = this.index.get(id);
    if (!meta) return null;

    // Load from file
    const records = this.loadFromFile(meta.date);
    const record = records.find(r => r.id === id);
    
    if (record) {
      this.updateCache(record);
    }

    return record || null;
  }

  /**
   * Query decisions with filters
   */
  async query(params: DecisionQuery = {}): Promise<DecisionRecord[]> {
    const {
      startTime,
      endTime,
      types,
      protocols,
      assets,
      minConfidence,
      executedOnly,
      withErrors,
      limit = 50,
      offset = 0,
    } = params;

    // Filter index entries
    let candidates: string[] = [];
    
    for (const [id, meta] of this.index.entries()) {
      const timestamp = parseInt(id.split('-')[0]);
      
      // Time range filter
      if (startTime && timestamp < startTime) continue;
      if (endTime && timestamp > endTime) continue;
      
      // Type filter
      if (types && types.length > 0 && !types.includes(meta.decisionType)) continue;
      
      // Protocol filter
      if (protocols && protocols.length > 0) {
        const hasProtocol = protocols.some(p => meta.protocols.includes(p));
        if (!hasProtocol) continue;
      }
      
      // Asset filter
      if (assets && assets.length > 0) {
        const hasAsset = assets.some(a => meta.assets.includes(a));
        if (!hasAsset) continue;
      }
      
      // Confidence filter
      if (minConfidence && meta.confidence < minConfidence) continue;
      
      // Execution filter
      if (executedOnly && !meta.executed) continue;
      
      // Error filter
      if (withErrors !== undefined && meta.hasError !== withErrors) continue;
      
      candidates.push(id);
    }

    // Sort by timestamp (newest first)
    candidates.sort((a, b) => {
      const tsA = parseInt(a.split('-')[0]);
      const tsB = parseInt(b.split('-')[0]);
      return tsB - tsA;
    });

    // Apply pagination
    const paged = candidates.slice(offset, offset + limit);

    // Load full records
    const records: DecisionRecord[] = [];
    for (const id of paged) {
      const record = await this.get(id);
      if (record) records.push(record);
    }

    return records;
  }

  /**
   * Get decision replay context (for debugging/auditing)
   */
  async getReplayContext(id: string): Promise<{
    decision: DecisionRecord;
    previousDecisions: DecisionRecord[];
    summary: string;
  } | null> {
    const decision = await this.get(id);
    if (!decision) return null;

    // Get 5 previous decisions for context
    const previous = await this.query({
      endTime: decision.decision.timestamp - 1,
      limit: 5,
    });

    const summary = this.generateReplaySummary(decision, previous);

    return {
      decision,
      previousDecisions: previous,
      summary,
    };
  }

  /**
   * Get statistics about decision history
   */
  getStats(): DecisionStats {
    const stats: DecisionStats = {
      totalDecisions: this.index.size,
      byType: { hold: 0, rebalance: 0, enter: 0, exit: 0 },
      byProtocol: {},
      executionRate: 0,
      avgConfidence: 0,
      riskChanges: { increased: 0, decreased: 0, unchanged: 0 },
      totalApyGained: 0,
      errorRate: 0,
      timeRange: { first: null, last: null },
    };

    let totalConfidence = 0;
    let executedCount = 0;
    let errorCount = 0;
    let timestamps: number[] = [];

    for (const [id, meta] of this.index.entries()) {
      // Type breakdown
      stats.byType[meta.decisionType]++;
      
      // Protocol breakdown
      for (const protocol of meta.protocols) {
        stats.byProtocol[protocol] = (stats.byProtocol[protocol] || 0) + 1;
      }
      
      // Confidence
      totalConfidence += meta.confidence;
      
      // Execution
      if (meta.executed) executedCount++;
      
      // Errors
      if (meta.hasError) errorCount++;
      
      // Risk changes
      if (meta.riskChange) {
        stats.riskChanges[meta.riskChange]++;
      }
      
      // APY impact
      if (meta.apyImpact > 0) {
        stats.totalApyGained += meta.apyImpact;
      }
      
      // Timestamps
      const ts = parseInt(id.split('-')[0]);
      timestamps.push(ts);
    }

    if (this.index.size > 0) {
      stats.executionRate = executedCount / this.index.size;
      stats.avgConfidence = totalConfidence / this.index.size;
      stats.errorRate = errorCount / this.index.size;
      stats.timeRange.first = Math.min(...timestamps);
      stats.timeRange.last = Math.max(...timestamps);
    }

    return stats;
  }

  /**
   * Export decisions for compliance/audit
   */
  async export(params: {
    startDate?: string;
    endDate?: string;
    format?: 'json' | 'csv';
  } = {}): Promise<AuditExport> {
    const { startDate, endDate } = params;
    
    const startTime = startDate ? new Date(startDate).getTime() : undefined;
    const endTime = endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined;

    const records = await this.query({
      startTime,
      endTime,
      limit: 10000, // High limit for export
    });

    const stats = this.getStats();

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      totalRecords: records.length,
      dateRange: {
        start: startDate || new Date(stats.timeRange.first || 0).toISOString().split('T')[0],
        end: endDate || new Date(stats.timeRange.last || 0).toISOString().split('T')[0],
      },
      records,
      statistics: stats,
      checksums: {
        recordCount: records.length,
        firstId: records[0]?.id || '',
        lastId: records[records.length - 1]?.id || '',
      },
    };
  }

  /**
   * Get timeline view (grouped by day/hour)
   */
  async getTimeline(params: {
    startTime?: number;
    endTime?: number;
    groupBy?: 'hour' | 'day';
  } = {}): Promise<{
    buckets: Array<{
      timestamp: number;
      label: string;
      decisions: number;
      rebalances: number;
      holds: number;
      executed: number;
      avgConfidence: number;
    }>;
  }> {
    const { startTime, endTime, groupBy = 'day' } = params;
    const buckets = new Map<string, {
      timestamp: number;
      decisions: number;
      rebalances: number;
      holds: number;
      executed: number;
      totalConfidence: number;
    }>();

    for (const [id, meta] of this.index.entries()) {
      const ts = parseInt(id.split('-')[0]);
      if (startTime && ts < startTime) continue;
      if (endTime && ts > endTime) continue;

      const date = new Date(ts);
      const key = groupBy === 'hour'
        ? date.toISOString().slice(0, 13) + ':00'
        : date.toISOString().split('T')[0];

      if (!buckets.has(key)) {
        buckets.set(key, {
          timestamp: date.getTime(),
          decisions: 0,
          rebalances: 0,
          holds: 0,
          executed: 0,
          totalConfidence: 0,
        });
      }

      const bucket = buckets.get(key)!;
      bucket.decisions++;
      if (meta.decisionType === 'rebalance') bucket.rebalances++;
      if (meta.decisionType === 'hold') bucket.holds++;
      if (meta.executed) bucket.executed++;
      bucket.totalConfidence += meta.confidence;
    }

    return {
      buckets: Array.from(buckets.entries())
        .map(([label, data]) => ({
          label,
          timestamp: data.timestamp,
          decisions: data.decisions,
          rebalances: data.rebalances,
          holds: data.holds,
          executed: data.executed,
          avgConfidence: data.decisions > 0 ? data.totalConfidence / data.decisions : 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp),
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(date: string): string {
    return join(this.dataDir, `decisions-${date}.json`);
  }

  private generateId(timestamp: number): string {
    const hash = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${hash}`;
  }

  private extractProtocols(decision: AutopilotDecision): string[] {
    const protocols = new Set<string>();
    
    for (const action of decision.actions) {
      if (action.from?.protocol) protocols.add(action.from.protocol);
      if (action.to?.protocol) protocols.add(action.to.protocol);
    }
    
    if (decision.riskAnalysis?.topOpportunity?.protocol) {
      protocols.add(decision.riskAnalysis.topOpportunity.protocol);
    }
    
    return Array.from(protocols);
  }

  private extractAssets(decision: AutopilotDecision): string[] {
    const assets = new Set<string>();
    
    for (const action of decision.actions) {
      if (action.from?.asset) assets.add(action.from.asset);
      if (action.to?.asset) assets.add(action.to.asset);
    }
    
    if (decision.riskAnalysis?.topOpportunity?.asset) {
      assets.add(decision.riskAnalysis.topOpportunity.asset);
    }
    
    return Array.from(assets);
  }

  private calculateApyImpact(decision: AutopilotDecision): number {
    return decision.actions.reduce((sum, a) => sum + (a.expectedApyGain || 0), 0);
  }

  private saveToFile(record: DecisionRecord, date: string): void {
    const filePath = this.getFilePath(date);
    let records: DecisionRecord[] = [];
    
    if (existsSync(filePath)) {
      try {
        records = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch {
        records = [];
      }
    }
    
    records.push(record);
    writeFileSync(filePath, JSON.stringify(records, null, 2));
  }

  private loadFromFile(date: string): DecisionRecord[] {
    const filePath = this.getFilePath(date);
    
    if (!existsSync(filePath)) return [];
    
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private buildIndex(): void {
    this.index.clear();
    
    if (!existsSync(this.dataDir)) return;
    
    const files = readdirSync(this.dataDir).filter(f => f.startsWith('decisions-'));
    
    for (const file of files) {
      const date = file.replace('decisions-', '').replace('.json', '');
      const filePath = this.getFilePath(date);
      const records = this.loadFromFile(date);
      
      for (const record of records) {
        this.index.set(record.id, { ...record.meta, filePath });
      }
    }
  }

  private updateCache(record: DecisionRecord): void {
    // LRU-style cache management
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(record.id, record);
  }

  private generateReplaySummary(
    decision: DecisionRecord,
    previous: DecisionRecord[]
  ): string {
    const lines: string[] = [];
    const d = decision.decision;
    const ctx = decision.context;
    
    lines.push('# Decision Replay Summary');
    lines.push('');
    lines.push(`**Decision ID:** ${decision.id}`);
    lines.push(`**Time:** ${new Date(d.timestamp).toISOString()}`);
    lines.push(`**Type:** ${d.type.toUpperCase()}`);
    lines.push(`**Confidence:** ${(d.confidence * 100).toFixed(0)}%`);
    lines.push(`**Executed:** ${d.executed ? '✅ Yes' : '❌ No'}`);
    lines.push('');
    
    // Portfolio state
    lines.push('## Portfolio at Decision Time');
    lines.push(`- Total Value: $${ctx.portfolioSnapshot.totalValue.toFixed(2)}`);
    lines.push(`- Weighted APY: ${ctx.portfolioSnapshot.weightedApy.toFixed(2)}%`);
    lines.push(`- Positions: ${ctx.portfolioSnapshot.positions.length}`);
    lines.push('');
    
    // Risk analysis
    if (d.riskAnalysis) {
      lines.push('## Risk Analysis');
      lines.push(`- Current Risk Score: ${d.riskAnalysis.currentRiskScore}/100`);
      lines.push(`- Proposed Risk Score: ${d.riskAnalysis.proposedRiskScore}/100`);
      lines.push(`- Risk Change: ${d.riskAnalysis.riskChange}`);
      
      if (d.riskAnalysis.topOpportunity) {
        const top = d.riskAnalysis.topOpportunity;
        lines.push('');
        lines.push('### Top Opportunity Considered');
        lines.push(`- ${top.asset} on ${top.protocol}`);
        lines.push(`- Raw APY: ${top.rawApy.toFixed(2)}%`);
        lines.push(`- Risk-Adjusted APY: ${top.adjustedApy.toFixed(2)}%`);
        lines.push(`- Sharpe Ratio: ${top.sharpeRatio.toFixed(2)}`);
        if (top.warnings.length) lines.push(`- ⚠️ Warnings: ${top.warnings.join(', ')}`);
        if (top.positives.length) lines.push(`- ✅ Positives: ${top.positives.join(', ')}`);
      }
    }
    lines.push('');
    
    // Full reasoning
    lines.push('## Full Reasoning');
    lines.push('```');
    lines.push(d.reasoning);
    lines.push('```');
    lines.push('');
    
    // Actions taken
    if (d.actions.length > 0) {
      lines.push('## Actions');
      for (const action of d.actions) {
        lines.push(`- **${action.type}**: ${action.from?.asset || '(none)'} → ${action.to?.asset || '(none)'}`);
        lines.push(`  - Expected APY Gain: +${(action.expectedApyGain || 0).toFixed(2)}%`);
      }
    }
    lines.push('');
    
    // Execution result
    if (d.executed) {
      lines.push('## Execution');
      lines.push(`- Status: ✅ Executed`);
      if (d.txIds && d.txIds.length > 0) {
        lines.push(`- Transaction IDs: ${d.txIds.join(', ')}`);
      }
    } else if (d.error) {
      lines.push('## Execution');
      lines.push(`- Status: ❌ Failed`);
      lines.push(`- Error: ${d.error}`);
    }
    lines.push('');
    
    // Context: previous decisions
    if (previous.length > 0) {
      lines.push('## Previous Decisions (Context)');
      for (const prev of previous) {
        const time = new Date(prev.decision.timestamp).toISOString();
        lines.push(`- ${time}: ${prev.decision.type} (${(prev.decision.confidence * 100).toFixed(0)}% conf)`);
      }
    }
    
    return lines.join('\n');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let historyStore: DecisionHistoryStore | null = null;

export function getHistoryStore(dataDir?: string): DecisionHistoryStore {
  if (!historyStore) {
    historyStore = new DecisionHistoryStore(dataDir);
  }
  return historyStore;
}
