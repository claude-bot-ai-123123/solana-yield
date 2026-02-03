/**
 * Live Autonomous Trading Mode
 * 
 * The brain of the autonomous agent - manages trading state, execution,
 * and safety controls for live DeFi operations.
 * 
 * Modes:
 * - MANUAL: Agent provides recommendations, human executes
 * - MONITORING: Agent monitors and alerts, no execution
 * - AUTONOMOUS: Full autonomous execution with safety rails
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { Autopilot, AutopilotDecision, AutopilotState } from './autopilot';
import { Executor } from './executor';
import { Strategy, Portfolio, RebalanceAction } from '../types';
import { fetchAllSolanaYields } from './defillama';
import { analyzeOpportunities, sortByRiskAdjustedReturn, RiskAdjustedOpportunity } from './risk';
import { getHistoryStore } from './history';

// ============================================================================
// Types
// ============================================================================

export type TradingMode = 'manual' | 'monitoring' | 'autonomous';

export interface TradingModeConfig {
  mode: TradingMode;
  // Safety limits
  maxTradeValueUsd: number;        // Max single trade size
  maxDailyTradesUsd: number;       // Max total daily volume
  maxPositionConcentration: number; // Max % in single position (0-1)
  maxSlippageBps: number;          // Max slippage in basis points
  // Timing
  minTimeBetweenTradesMs: number;  // Cooldown between trades
  decisionIntervalMs: number;      // How often to analyze
  // Circuit breakers
  maxConsecutiveLosses: number;    // Pause after N consecutive losses
  maxDrawdownPercent: number;      // Pause if drawdown exceeds %
  emergencyExitThreshold: number;  // Force exit if risk score exceeds
  // Approvals
  requireApprovalAboveUsd: number; // Manual approval for trades above this
}

export interface PendingTrade {
  id: string;
  timestamp: number;
  action: RebalanceAction;
  decision: AutopilotDecision;
  estimatedValueUsd: number;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  requiresApproval: boolean;
  approvedAt?: number;
  approvedBy?: string;
  executedAt?: number;
  txId?: string;
  error?: string;
}

export interface TradingState {
  mode: TradingMode;
  isActive: boolean;
  isPaused: boolean;
  pauseReason?: string;
  // Stats
  tradesExecutedToday: number;
  totalVolumeToday: number;
  consecutiveLosses: number;
  currentDrawdown: number;
  peakValue: number;
  // Tracking
  lastDecisionTime: number | null;
  lastTradeTime: number | null;
  pendingTrades: PendingTrade[];
  // Portfolio
  portfolio: Portfolio | null;
  // Market data
  currentYields: RiskAdjustedOpportunity[];
  // Session
  sessionStartTime: number;
  sessionId: string;
}

export interface TradingEvent {
  type: 'mode_change' | 'decision' | 'trade_queued' | 'trade_approved' | 
        'trade_executed' | 'trade_failed' | 'circuit_breaker' | 'emergency_stop' |
        'yield_update' | 'portfolio_update' | 'alert';
  timestamp: number;
  data: unknown;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_TRADING_CONFIG: TradingModeConfig = {
  mode: 'monitoring',
  maxTradeValueUsd: 1000,
  maxDailyTradesUsd: 5000,
  maxPositionConcentration: 0.5,
  maxSlippageBps: 100, // 1%
  minTimeBetweenTradesMs: 60 * 1000, // 1 minute
  decisionIntervalMs: 5 * 60 * 1000, // 5 minutes
  maxConsecutiveLosses: 3,
  maxDrawdownPercent: 10,
  emergencyExitThreshold: 80,
  requireApprovalAboveUsd: 500,
};

// ============================================================================
// TradingModeManager
// ============================================================================

export class TradingModeManager extends EventEmitter {
  private connection: Connection;
  private keypair: Keypair;
  private strategy: Strategy;
  private config: TradingModeConfig;
  private executor: Executor;
  private historyStore = getHistoryStore();
  
  private state: TradingState;
  private decisionInterval: NodeJS.Timeout | null = null;
  private portfolioInterval: NodeJS.Timeout | null = null;

  constructor(
    connection: Connection,
    keypair: Keypair,
    strategy: Strategy,
    config: Partial<TradingModeConfig> = {}
  ) {
    super();
    this.connection = connection;
    this.keypair = keypair;
    this.strategy = strategy;
    this.config = { ...DEFAULT_TRADING_CONFIG, ...config };
    this.executor = new Executor(connection, keypair);
    
    this.state = this.createInitialState();
  }

  private createInitialState(): TradingState {
    return {
      mode: this.config.mode,
      isActive: false,
      isPaused: false,
      tradesExecutedToday: 0,
      totalVolumeToday: 0,
      consecutiveLosses: 0,
      currentDrawdown: 0,
      peakValue: 0,
      lastDecisionTime: null,
      lastTradeTime: null,
      pendingTrades: [],
      portfolio: null,
      currentYields: [],
      sessionStartTime: Date.now(),
      sessionId: generateSessionId(),
    };
  }

  // ============================================================================
  // Mode Control
  // ============================================================================

  /**
   * Start the trading mode manager
   */
  async start(): Promise<void> {
    if (this.state.isActive) return;
    
    this.state.isActive = true;
    this.state.sessionStartTime = Date.now();
    this.state.sessionId = generateSessionId();
    
    // Initial portfolio fetch
    await this.refreshPortfolio();
    
    // Initial yield fetch
    await this.refreshYields();
    
    // Start decision loop
    this.startDecisionLoop();
    
    // Start portfolio monitoring
    this.startPortfolioMonitoring();
    
    this.emitEvent('mode_change', {
      mode: this.state.mode,
      isActive: true,
      sessionId: this.state.sessionId,
    });
    
    console.log(`🚀 Trading Mode Manager started in ${this.state.mode.toUpperCase()} mode`);
  }

  /**
   * Stop the trading mode manager
   */
  stop(): void {
    if (!this.state.isActive) return;
    
    this.state.isActive = false;
    
    if (this.decisionInterval) {
      clearInterval(this.decisionInterval);
      this.decisionInterval = null;
    }
    
    if (this.portfolioInterval) {
      clearInterval(this.portfolioInterval);
      this.portfolioInterval = null;
    }
    
    this.emitEvent('mode_change', {
      mode: this.state.mode,
      isActive: false,
      sessionId: this.state.sessionId,
    });
    
    console.log('🛑 Trading Mode Manager stopped');
  }

  /**
   * Change trading mode
   */
  setMode(mode: TradingMode): void {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    
    this.emitEvent('mode_change', {
      previousMode,
      newMode: mode,
      timestamp: Date.now(),
    });
    
    console.log(`📊 Trading mode changed: ${previousMode} → ${mode}`);
    
    // If switching to autonomous, verify safety
    if (mode === 'autonomous') {
      this.verifySafetyForAutonomous();
    }
  }

  /**
   * Pause trading (emergency or circuit breaker)
   */
  pause(reason: string): void {
    this.state.isPaused = true;
    this.state.pauseReason = reason;
    
    this.emitEvent('circuit_breaker', {
      reason,
      timestamp: Date.now(),
      state: this.getState(),
    });
    
    console.log(`⏸️ Trading paused: ${reason}`);
  }

  /**
   * Resume trading after pause
   */
  resume(): void {
    this.state.isPaused = false;
    this.state.pauseReason = undefined;
    
    this.emitEvent('mode_change', {
      action: 'resume',
      mode: this.state.mode,
      timestamp: Date.now(),
    });
    
    console.log('▶️ Trading resumed');
  }

  /**
   * Emergency stop - immediately exit all positions
   */
  async emergencyStop(reason: string): Promise<void> {
    this.pause('EMERGENCY: ' + reason);
    
    this.emitEvent('emergency_stop', {
      reason,
      timestamp: Date.now(),
      portfolio: this.state.portfolio,
    });
    
    console.log(`🚨 EMERGENCY STOP: ${reason}`);
    
    // In production, would trigger emergency exit of all positions
    // For hackathon demo, we just pause and alert
  }

  // ============================================================================
  // Decision Loop
  // ============================================================================

  private startDecisionLoop(): void {
    // Run immediately
    this.runDecisionCycle();
    
    // Then on interval
    this.decisionInterval = setInterval(
      () => this.runDecisionCycle(),
      this.config.decisionIntervalMs
    );
  }

  private async runDecisionCycle(): Promise<void> {
    if (!this.state.isActive || this.state.isPaused) return;
    
    try {
      const timestamp = Date.now();
      this.state.lastDecisionTime = timestamp;
      
      // 1. Refresh yields
      await this.refreshYields();
      
      // 2. Analyze and decide
      const decision = await this.analyzeAndDecide();
      
      // 3. Emit decision event
      this.emitEvent('decision', decision);
      
      // 4. Handle based on mode
      if (decision.actions.length > 0) {
        switch (this.state.mode) {
          case 'manual':
            // Just emit alert, don't queue
            this.emitEvent('alert', {
              type: 'recommendation',
              message: `Recommended action: ${decision.type}`,
              decision,
            });
            break;
            
          case 'monitoring':
            // Emit detailed alert
            this.emitEvent('alert', {
              type: 'opportunity',
              message: `Opportunity detected: ${decision.type} (${(decision.confidence * 100).toFixed(0)}% confidence)`,
              decision,
            });
            break;
            
          case 'autonomous':
            // Queue for execution
            await this.queueTrades(decision);
            break;
        }
      }
      
      // 5. Record to history
      const portfolioSnapshot = this.state.portfolio || {
        totalValue: 0,
        weightedApy: 0,
        positions: [],
      };
      
      await this.historyStore.record(decision, {
        portfolioSnapshot,
        yieldSnapshot: this.state.currentYields.slice(0, 20) as any, // YieldOpportunity[]
        riskAnalyzedYields: this.state.currentYields.slice(0, 20),
        strategyConfig: this.strategy,
        tradingMode: this.state.mode,
        sessionId: this.state.sessionId,
      });
      
    } catch (err) {
      console.error('Decision cycle error:', err);
      this.emitEvent('alert', {
        type: 'error',
        message: `Decision cycle failed: ${err}`,
      });
    }
  }

  private async analyzeAndDecide(): Promise<AutopilotDecision> {
    const timestamp = Date.now();
    const reasoning: string[] = [];
    
    // Get risk-adjusted opportunities
    const maxRiskScore = this.getRiskToleranceScore();
    const eligible = this.state.currentYields.filter(o => o.riskScore.overall <= maxRiskScore);
    
    if (eligible.length === 0 || !this.state.portfolio) {
      return {
        timestamp,
        type: 'hold',
        reasoning: 'No opportunities within risk tolerance or no portfolio data',
        confidence: 0.9,
        actions: [],
        executed: false,
      };
    }
    
    const sorted = sortByRiskAdjustedReturn(eligible);
    const best = sorted[0];
    
    // Calculate current portfolio APY
    const currentApy = this.state.portfolio.weightedApy;
    const improvement = best.adjustedApy - currentApy;
    
    reasoning.push(`📊 Analysis at ${new Date(timestamp).toISOString()}`);
    reasoning.push(`Current portfolio APY: ${currentApy.toFixed(2)}%`);
    reasoning.push(`Best opportunity: ${best.asset} on ${best.protocol} @ ${best.adjustedApy.toFixed(2)}% (risk-adj)`);
    reasoning.push(`Potential improvement: ${improvement.toFixed(2)}%`);
    
    // Check if improvement is worth it
    if (improvement < this.strategy.rebalanceThreshold) {
      reasoning.push('Improvement below threshold — holding');
      return {
        timestamp,
        type: 'hold',
        reasoning: reasoning.join('\n'),
        confidence: 0.85,
        actions: [],
        executed: false,
        riskAnalysis: {
          currentRiskScore: 50,
          proposedRiskScore: 50,
          riskChange: 'unchanged',
        },
      };
    }
    
    // Check safety limits
    const safetyCheck = this.checkSafetyLimits();
    if (!safetyCheck.passed) {
      reasoning.push(`⚠️ Safety limit: ${safetyCheck.reason}`);
      return {
        timestamp,
        type: 'hold',
        reasoning: reasoning.join('\n'),
        confidence: 0.9,
        actions: [],
        executed: false,
      };
    }
    
    // Build rebalance action
    const actions: RebalanceAction[] = [];
    
    // For now, recommend moving SOL to best opportunity
    if (this.state.portfolio.positions.length > 0) {
      const currentPos = this.state.portfolio.positions[0];
      if (best.protocol !== currentPos.protocol || best.asset !== currentPos.asset) {
        actions.push({
          type: 'withdraw',
          from: {
            protocol: currentPos.protocol,
            asset: currentPos.asset,
            amount: currentPos.amount,
          },
          to: {
            protocol: best.protocol,
            asset: best.asset,
            amount: currentPos.amount,
          },
          expectedApyGain: improvement,
        });
        reasoning.push(`→ Rebalance ${currentPos.asset} from ${currentPos.protocol} to ${best.protocol}`);
      }
    }
    
    return {
      timestamp,
      type: actions.length > 0 ? 'rebalance' : 'hold',
      reasoning: reasoning.join('\n'),
      confidence: 0.75 + (improvement / 20), // Higher improvement = higher confidence
      actions,
      executed: false,
      riskAnalysis: {
        currentRiskScore: 50,
        proposedRiskScore: best.riskScore.overall,
        riskChange: best.riskScore.overall < 50 ? 'decreased' : 'increased',
        topOpportunity: {
          protocol: best.protocol,
          asset: best.asset,
          rawApy: best.apy,
          adjustedApy: best.adjustedApy,
          sharpeRatio: best.sharpeRatio,
          riskScore: best.riskScore.overall,
          warnings: best.riskScore.warnings,
          positives: best.riskScore.positives,
        },
      },
    };
  }

  // ============================================================================
  // Trade Queue & Execution
  // ============================================================================

  private async queueTrades(decision: AutopilotDecision): Promise<void> {
    for (const action of decision.actions) {
      const estimatedValue = action.from?.amount || 0;
      const estimatedValueUsd = estimatedValue * 180; // Assume SOL price
      
      const trade: PendingTrade = {
        id: generateTradeId(),
        timestamp: Date.now(),
        action,
        decision,
        estimatedValueUsd,
        status: 'pending',
        requiresApproval: estimatedValueUsd > this.config.requireApprovalAboveUsd,
      };
      
      this.state.pendingTrades.push(trade);
      
      this.emitEvent('trade_queued', trade);
      
      console.log(`📝 Trade queued: ${trade.id} (${trade.requiresApproval ? 'requires approval' : 'auto-approve'})`);
      
      // Auto-approve if under threshold
      if (!trade.requiresApproval) {
        await this.approveTrade(trade.id, 'auto');
      }
    }
  }

  /**
   * Approve a pending trade (manual or auto)
   */
  async approveTrade(tradeId: string, approvedBy: string = 'manual'): Promise<boolean> {
    const trade = this.state.pendingTrades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'pending') {
      return false;
    }
    
    trade.status = 'approved';
    trade.approvedAt = Date.now();
    trade.approvedBy = approvedBy;
    
    this.emitEvent('trade_approved', trade);
    
    console.log(`✅ Trade approved: ${tradeId} by ${approvedBy}`);
    
    // Execute immediately if in autonomous mode
    if (this.state.mode === 'autonomous') {
      await this.executeTrade(tradeId);
    }
    
    return true;
  }

  /**
   * Reject a pending trade
   */
  rejectTrade(tradeId: string, reason: string = 'manual rejection'): boolean {
    const trade = this.state.pendingTrades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'pending') {
      return false;
    }
    
    trade.status = 'rejected';
    trade.error = reason;
    
    console.log(`❌ Trade rejected: ${tradeId} - ${reason}`);
    
    return true;
  }

  /**
   * Execute an approved trade
   */
  private async executeTrade(tradeId: string): Promise<void> {
    const trade = this.state.pendingTrades.find(t => t.id === tradeId);
    if (!trade || trade.status !== 'approved') {
      return;
    }
    
    // Check cooldown
    if (this.state.lastTradeTime) {
      const timeSinceLastTrade = Date.now() - this.state.lastTradeTime;
      if (timeSinceLastTrade < this.config.minTimeBetweenTradesMs) {
        console.log(`⏳ Trade cooldown: ${Math.ceil((this.config.minTimeBetweenTradesMs - timeSinceLastTrade) / 1000)}s remaining`);
        return;
      }
    }
    
    // Check daily limits
    if (this.state.totalVolumeToday + trade.estimatedValueUsd > this.config.maxDailyTradesUsd) {
      trade.status = 'failed';
      trade.error = 'Daily volume limit exceeded';
      this.emitEvent('trade_failed', trade);
      return;
    }
    
    trade.status = 'executing';
    
    try {
      console.log(`⚡ Executing trade: ${tradeId}`);
      
      const txIds = await this.executor.executeActions(
        [trade.action],
        { maxSlippage: this.config.maxSlippageBps / 10000 }
      );
      
      trade.status = 'completed';
      trade.executedAt = Date.now();
      trade.txId = txIds[0];
      
      // Update stats
      this.state.tradesExecutedToday++;
      this.state.totalVolumeToday += trade.estimatedValueUsd;
      this.state.lastTradeTime = Date.now();
      this.state.consecutiveLosses = 0; // Reset on successful trade
      
      this.emitEvent('trade_executed', {
        trade,
        txId: txIds[0],
        stats: {
          tradesExecutedToday: this.state.tradesExecutedToday,
          totalVolumeToday: this.state.totalVolumeToday,
        },
      });
      
      console.log(`✅ Trade executed: ${txIds[0]}`);
      
    } catch (err) {
      trade.status = 'failed';
      trade.error = String(err);
      
      this.state.consecutiveLosses++;
      
      // Check circuit breaker
      if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.pause(`Circuit breaker: ${this.state.consecutiveLosses} consecutive failures`);
      }
      
      this.emitEvent('trade_failed', {
        trade,
        error: String(err),
        consecutiveLosses: this.state.consecutiveLosses,
      });
      
      console.error(`❌ Trade failed: ${err}`);
    }
  }

  // ============================================================================
  // Portfolio Monitoring
  // ============================================================================

  private startPortfolioMonitoring(): void {
    this.portfolioInterval = setInterval(
      () => this.refreshPortfolio(),
      30 * 1000 // Every 30 seconds
    );
  }

  private async refreshPortfolio(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      const solPrice = 180; // TODO: Fetch real price
      const valueUsd = solBalance * solPrice;
      
      // Track peak for drawdown calculation
      if (valueUsd > this.state.peakValue) {
        this.state.peakValue = valueUsd;
      }
      
      // Calculate drawdown
      if (this.state.peakValue > 0) {
        this.state.currentDrawdown = ((this.state.peakValue - valueUsd) / this.state.peakValue) * 100;
        
        // Check drawdown circuit breaker
        if (this.state.currentDrawdown > this.config.maxDrawdownPercent) {
          this.pause(`Drawdown exceeded ${this.config.maxDrawdownPercent}% (current: ${this.state.currentDrawdown.toFixed(2)}%)`);
        }
      }
      
      const newPortfolio: Portfolio = {
        totalValue: valueUsd,
        weightedApy: 5.2, // TODO: Calculate from actual positions
        positions: solBalance > 0.01 ? [{
          protocol: 'native',
          asset: 'SOL',
          amount: solBalance,
          valueUsd,
          currentApy: 5.2,
          entryTime: new Date(),
        }] : [],
      };
      
      const changed = !this.state.portfolio || 
        Math.abs(this.state.portfolio.totalValue - newPortfolio.totalValue) > 0.01;
      
      this.state.portfolio = newPortfolio;
      
      if (changed) {
        this.emitEvent('portfolio_update', {
          portfolio: newPortfolio,
          drawdown: this.state.currentDrawdown,
          peakValue: this.state.peakValue,
        });
      }
    } catch (err) {
      console.error('Portfolio refresh error:', err);
    }
  }

  private async refreshYields(): Promise<void> {
    try {
      const yields = await fetchAllSolanaYields();
      const analyzed = analyzeOpportunities(yields);
      this.state.currentYields = sortByRiskAdjustedReturn(analyzed).slice(0, 50);
      
      this.emitEvent('yield_update', {
        count: this.state.currentYields.length,
        top: this.state.currentYields.slice(0, 5).map(y => ({
          protocol: y.protocol,
          asset: y.asset,
          apy: y.apy,
          adjustedApy: y.adjustedApy,
          riskScore: y.riskScore.overall,
        })),
      });
    } catch (err) {
      console.error('Yield refresh error:', err);
    }
  }

  // ============================================================================
  // Safety & Validation
  // ============================================================================

  private checkSafetyLimits(): { passed: boolean; reason?: string } {
    // Check daily volume
    if (this.state.totalVolumeToday >= this.config.maxDailyTradesUsd) {
      return { passed: false, reason: 'Daily volume limit reached' };
    }
    
    // Check drawdown
    if (this.state.currentDrawdown > this.config.maxDrawdownPercent) {
      return { passed: false, reason: `Drawdown too high: ${this.state.currentDrawdown.toFixed(2)}%` };
    }
    
    // Check consecutive losses
    if (this.state.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      return { passed: false, reason: `Too many consecutive losses: ${this.state.consecutiveLosses}` };
    }
    
    // Check pause state
    if (this.state.isPaused) {
      return { passed: false, reason: this.state.pauseReason };
    }
    
    return { passed: true };
  }

  private verifySafetyForAutonomous(): void {
    const checks = [
      { name: 'Keypair loaded', passed: !!this.keypair },
      { name: 'Connection active', passed: !!this.connection },
      { name: 'Strategy configured', passed: !!this.strategy },
      { name: 'Safety limits set', passed: this.config.maxTradeValueUsd > 0 },
    ];
    
    const failed = checks.filter(c => !c.passed);
    if (failed.length > 0) {
      console.warn('⚠️ Safety checks failed:', failed.map(c => c.name).join(', '));
    } else {
      console.log('✅ All safety checks passed for autonomous mode');
    }
  }

  private getRiskToleranceScore(): number {
    switch (this.strategy.riskTolerance) {
      case 'low': return 35;
      case 'medium': return 55;
      case 'high': return 75;
      default: return 55;
    }
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  private emitEvent(type: TradingEvent['type'], data: unknown): void {
    const event: TradingEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.emit('event', event);
    this.emit(type, data);
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getState(): TradingState {
    return { ...this.state };
  }

  getConfig(): TradingModeConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<TradingModeConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getPendingTrades(): PendingTrade[] {
    return this.state.pendingTrades.filter(t => t.status === 'pending');
  }

  getTradeHistory(): PendingTrade[] {
    return [...this.state.pendingTrades];
  }

  /**
   * Get comprehensive status summary
   */
  getStatusSummary(): string {
    const s = this.state;
    const lines = [
      `🤖 **Live Trading Mode: ${s.mode.toUpperCase()}**`,
      `Status: ${s.isActive ? (s.isPaused ? '⏸️ Paused' : '🟢 Active') : '🔴 Inactive'}`,
      s.pauseReason ? `Pause reason: ${s.pauseReason}` : '',
      '',
      `**Session Stats**`,
      `Started: ${new Date(s.sessionStartTime).toISOString()}`,
      `Trades today: ${s.tradesExecutedToday}`,
      `Volume today: $${s.totalVolumeToday.toFixed(2)}`,
      `Consecutive losses: ${s.consecutiveLosses}`,
      '',
      `**Portfolio**`,
      s.portfolio ? `Value: $${s.portfolio.totalValue.toFixed(2)}` : 'No portfolio data',
      s.portfolio ? `Weighted APY: ${s.portfolio.weightedApy.toFixed(2)}%` : '',
      `Drawdown: ${s.currentDrawdown.toFixed(2)}%`,
      `Peak value: $${s.peakValue.toFixed(2)}`,
      '',
      `**Pending Trades**`,
      s.pendingTrades.filter(t => t.status === 'pending').length > 0
        ? s.pendingTrades.filter(t => t.status === 'pending').map(t => 
            `• ${t.id}: $${t.estimatedValueUsd.toFixed(2)} (${t.requiresApproval ? 'needs approval' : 'auto'})`
          ).join('\n')
        : 'No pending trades',
      '',
      `**Top Opportunities**`,
      ...s.currentYields.slice(0, 3).map((y, i) => 
        `${i + 1}. ${y.asset} (${y.protocol}): ${y.adjustedApy.toFixed(2)}% adj | Risk: ${y.riskScore.overall}`
      ),
    ].filter(Boolean);
    
    return lines.join('\n');
  }
}

// ============================================================================
// Utilities
// ============================================================================

function generateSessionId(): string {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTradeId(): string {
  return `trade_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
