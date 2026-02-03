/**
 * Autopilot - Autonomous yield optimization engine
 * The "Most Agentic" feature of SolanaYield
 * 
 * Runs continuously, monitors yields, makes decisions, executes trades
 * All decisions are logged with reasoning for transparency
 * 
 * Key feature: Risk-adjusted recommendations (not just highest APY)
 */

import { Connection, Keypair } from '@solana/web3.js';
import { fetchAllSolanaYields } from './defillama';
import { StrategyEngine, StrategyDecision } from './strategy';
import { Executor } from './executor';
import { Strategy, Portfolio, YieldOpportunity, RebalanceAction } from '../types';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn,
  getTopRecommendations,
  RiskAdjustedOpportunity,
} from './risk';
import { getHistoryStore } from './history';

export interface AutopilotDecision {
  timestamp: number;
  type: 'hold' | 'rebalance' | 'enter' | 'exit';
  reasoning: string;
  confidence: number; // 0-1
  actions: RebalanceAction[];
  executed: boolean;
  txIds?: string[];
  error?: string;
  // New: risk analysis
  riskAnalysis?: {
    currentRiskScore: number;
    proposedRiskScore: number;
    riskChange: 'increased' | 'decreased' | 'unchanged';
    topOpportunity?: {
      protocol: string;
      asset: string;
      rawApy: number;
      adjustedApy: number;
      sharpeRatio: number;
      riskScore: number;
      warnings: string[];
      positives: string[];
    };
  };
}

export interface AutopilotState {
  isRunning: boolean;
  lastCheck: number | null;
  lastDecision: AutopilotDecision | null;
  decisionHistory: AutopilotDecision[];
  currentYields: YieldOpportunity[];
  riskAdjustedYields: RiskAdjustedOpportunity[];
  portfolio: Portfolio | null;
  stats: {
    totalDecisions: number;
    rebalances: number;
    holds: number;
    errors: number;
    totalApyGained: number;
    totalRiskAdjustedApyGained: number;
  };
}

export class Autopilot {
  private connection: Connection;
  private keypair: Keypair;
  private strategy: Strategy;
  private strategyEngine: StrategyEngine;
  private executor: Executor;
  private state: AutopilotState;
  private intervalId: NodeJS.Timeout | null = null;
  private historyStore = getHistoryStore();

  constructor(
    connection: Connection,
    keypair: Keypair,
    strategy: Strategy
  ) {
    this.connection = connection;
    this.keypair = keypair;
    this.strategy = strategy;
    this.strategyEngine = new StrategyEngine(strategy);
    this.executor = new Executor(connection, keypair);
    
    this.state = {
      isRunning: false,
      lastCheck: null,
      lastDecision: null,
      decisionHistory: [],
      currentYields: [],
      riskAdjustedYields: [],
      portfolio: null,
      stats: {
        totalDecisions: 0,
        rebalances: 0,
        holds: 0,
        errors: 0,
        totalApyGained: 0,
        totalRiskAdjustedApyGained: 0,
      },
    };
  }

  /**
   * Start autonomous monitoring and execution
   */
  start(intervalMs: number = 60000): void {
    if (this.state.isRunning) return;
    
    this.state.isRunning = true;
    console.log(`🤖 Autopilot started (checking every ${intervalMs / 1000}s)`);
    
    // Run immediately
    this.runCycle();
    
    // Then run on interval
    this.intervalId = setInterval(() => this.runCycle(), intervalMs);
  }

  /**
   * Stop autonomous monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state.isRunning = false;
    console.log('🛑 Autopilot stopped');
  }

  /**
   * Run a single decision cycle
   */
  async runCycle(): Promise<AutopilotDecision> {
    const timestamp = Date.now();
    this.state.lastCheck = timestamp;

    try {
      // 1. Fetch current yields
      console.log('📊 Fetching yields...');
      const yields = await fetchAllSolanaYields();
      this.state.currentYields = yields.slice(0, 50);
      
      // 2. Analyze with risk scoring (enhanced with AEGIS!)
      console.log('🔍 Analyzing risk-adjusted yields...');
      const analyzed = analyzeOpportunities(yields);
      this.state.riskAdjustedYields = sortByRiskAdjustedReturn(analyzed).slice(0, 50);

      // 3. Get current portfolio
      const portfolio = await this.getPortfolio();
      this.state.portfolio = portfolio;

      // 4. Analyze and decide (using risk-adjusted strategy)
      const decision = await this.analyzeAndDecide(yields, portfolio);
      
      // 5. Execute if confidence is high enough
      if (decision.confidence >= 0.7 && decision.actions.length > 0) {
        try {
          const txIds = await this.executor.executeActions(decision.actions, {
            maxSlippage: this.strategy.maxSlippage,
          });
          decision.executed = true;
          decision.txIds = txIds;
          this.state.stats.rebalances++;
          
          // Track APY gain
          const apyGain = decision.actions.reduce((sum, a) => sum + (a.expectedApyGain || 0), 0);
          this.state.stats.totalApyGained += apyGain;
          this.state.stats.totalRiskAdjustedApyGained += apyGain; // Already risk-adjusted from strategy
        } catch (err) {
          decision.error = String(err);
          this.state.stats.errors++;
        }
      } else {
        decision.executed = false;
        if (decision.type === 'hold') {
          this.state.stats.holds++;
        }
      }

      // 6. Record decision to state
      this.state.lastDecision = decision;
      this.state.decisionHistory.push(decision);
      this.state.stats.totalDecisions++;

      // Keep in-memory history bounded
      if (this.state.decisionHistory.length > 100) {
        this.state.decisionHistory = this.state.decisionHistory.slice(-100);
      }

      // 7. Record to persistent audit trail
      try {
        await this.historyStore.record(decision, {
          portfolioSnapshot: portfolio,
          yieldSnapshot: yields.slice(0, 20),
          riskAnalyzedYields: this.state.riskAdjustedYields.slice(0, 20),
          strategyConfig: this.strategy,
          marketConditions: {
            solPrice: 180, // TODO: fetch real price
            avgApy: yields.reduce((sum, y) => sum + y.apy, 0) / yields.length,
          },
        });
        console.log(`📝 Decision recorded to audit trail`);
      } catch (historyErr) {
        console.error(`⚠️ Failed to record decision to history: ${historyErr}`);
      }

      console.log(`🧠 Decision: ${decision.type} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
      console.log(`   Reasoning: ${decision.reasoning.split('\n')[0]}`);

      return decision;

    } catch (err) {
      const decision: AutopilotDecision = {
        timestamp,
        type: 'hold',
        reasoning: `Error during analysis: ${err}`,
        confidence: 0,
        actions: [],
        executed: false,
        error: String(err),
      };
      this.state.lastDecision = decision;
      this.state.stats.errors++;
      return decision;
    }
  }

  /**
   * Core decision-making logic with risk-adjusted reasoning
   */
  private async analyzeAndDecide(
    yields: YieldOpportunity[],
    portfolio: Portfolio
  ): Promise<AutopilotDecision> {
    const timestamp = Date.now();
    const reasoning: string[] = [];
    let confidence = 0.5;

    // Use the full strategy engine analysis (enhanced with AEGIS!)
    const strategyDecision = this.strategyEngine.analyzeWithReasoning(portfolio, yields);
    
    // Get top risk-adjusted recommendations (enhanced with AEGIS!)
    const maxRiskScore = this.getRiskToleranceScore();
    const topRecommendations = getTopRecommendations(yields, 5, maxRiskScore);
    
    if (topRecommendations.length === 0) {
      return {
        timestamp,
        type: 'hold',
        reasoning: 'No opportunities within risk tolerance',
        confidence: 0.9,
        actions: [],
        executed: false,
        riskAnalysis: {
          currentRiskScore: strategyDecision.riskAnalysis.currentRiskScore,
          proposedRiskScore: strategyDecision.riskAnalysis.currentRiskScore,
          riskChange: 'unchanged',
        },
      };
    }

    const topOpp = topRecommendations[0];

    // Build comprehensive reasoning
    reasoning.push(`📊 **Risk-Adjusted Analysis**`);
    reasoning.push(`Found ${topRecommendations.length} opportunities within risk tolerance`);
    reasoning.push('');
    reasoning.push(`🏆 **Top Recommendation:** ${topOpp.asset} on ${topOpp.protocol}`);
    reasoning.push(`   • Raw APY: ${topOpp.apy.toFixed(2)}%`);
    reasoning.push(`   • Risk-adjusted APY: ${topOpp.adjustedApy.toFixed(2)}%`);
    reasoning.push(`   • Risk Score: ${topOpp.riskScore.overall}/100`);
    reasoning.push(`   • Sharpe Ratio: ${topOpp.sharpeRatio.toFixed(2)}`);
    reasoning.push(`   • TVL: $${formatNumber(topOpp.tvl)}`);
    
    if (topOpp.riskScore.positives.length > 0) {
      reasoning.push(`   ✅ ${topOpp.riskScore.positives.join(', ')}`);
    }
    if (topOpp.riskScore.warnings.length > 0) {
      reasoning.push(`   ⚠️ ${topOpp.riskScore.warnings.join(', ')}`);
    }

    // Compare to current portfolio
    reasoning.push('');
    reasoning.push(`📈 **Portfolio Comparison**`);
    reasoning.push(`   • Current APY: ${portfolio.weightedApy.toFixed(2)}%`);
    reasoning.push(`   • Projected APY: ${strategyDecision.projectedApy.toFixed(2)}%`);
    reasoning.push(`   • Risk-adjusted improvement: ${(strategyDecision.projectedRiskAdjustedApy - portfolio.weightedApy).toFixed(2)}%`);

    // Check if portfolio is empty
    if (portfolio.totalValue === 0) {
      reasoning.push('');
      reasoning.push('💡 Portfolio is empty — recommending initial entry');
      return {
        timestamp,
        type: 'enter',
        reasoning: reasoning.join('\n'),
        confidence: 0.8,
        actions: [{
          type: 'deposit',
          to: {
            protocol: topOpp.protocol,
            asset: topOpp.asset,
            amount: 0, // Filled by user input
          },
          expectedApyGain: topOpp.adjustedApy,
        }],
        executed: false,
        riskAnalysis: {
          currentRiskScore: 0,
          proposedRiskScore: topOpp.riskScore.overall,
          riskChange: 'increased',
          topOpportunity: {
            protocol: topOpp.protocol,
            asset: topOpp.asset,
            rawApy: topOpp.apy,
            adjustedApy: topOpp.adjustedApy,
            sharpeRatio: topOpp.sharpeRatio,
            riskScore: topOpp.riskScore.overall,
            warnings: topOpp.riskScore.warnings,
            positives: topOpp.riskScore.positives,
          },
        },
      };
    }

    // Use strategy decision actions
    if (strategyDecision.actions.length === 0) {
      reasoning.push('');
      reasoning.push('⏸️ **Decision: HOLD**');
      reasoning.push('Risk-adjusted improvement below threshold — holding current positions');
      
      return {
        timestamp,
        type: 'hold',
        reasoning: reasoning.join('\n'),
        confidence: strategyDecision.confidence,
        actions: [],
        executed: false,
        riskAnalysis: {
          currentRiskScore: strategyDecision.riskAnalysis.currentRiskScore,
          proposedRiskScore: strategyDecision.riskAnalysis.proposedRiskScore,
          riskChange: strategyDecision.riskAnalysis.riskChange,
          topOpportunity: {
            protocol: topOpp.protocol,
            asset: topOpp.asset,
            rawApy: topOpp.apy,
            adjustedApy: topOpp.adjustedApy,
            sharpeRatio: topOpp.sharpeRatio,
            riskScore: topOpp.riskScore.overall,
            warnings: topOpp.riskScore.warnings,
            positives: topOpp.riskScore.positives,
          },
        },
      };
    }

    // Rebalancing recommended
    reasoning.push('');
    reasoning.push('🔄 **Decision: REBALANCE**');
    reasoning.push(`Moving to better risk-adjusted opportunities`);
    reasoning.push(`Risk change: ${strategyDecision.riskAnalysis.riskChange}`);

    // Add TVL safety check
    if (topOpp.tvl < 1_000_000) {
      confidence -= 0.15;
      reasoning.push(`⚠️ Lower confidence due to TVL < $1M`);
    }

    // Add risk change to confidence
    if (strategyDecision.riskAnalysis.riskChange === 'decreased') {
      confidence += 0.1;
      reasoning.push(`✅ Risk decreasing — higher confidence`);
    } else if (strategyDecision.riskAnalysis.riskChange === 'increased') {
      confidence -= 0.1;
      reasoning.push(`⚠️ Risk increasing — lower confidence`);
    }

    confidence = Math.min(0.95, Math.max(0.3, strategyDecision.confidence + (confidence - 0.5)));

    return {
      timestamp,
      type: 'rebalance',
      reasoning: reasoning.join('\n'),
      confidence,
      actions: strategyDecision.actions,
      executed: false,
      riskAnalysis: {
        currentRiskScore: strategyDecision.riskAnalysis.currentRiskScore,
        proposedRiskScore: strategyDecision.riskAnalysis.proposedRiskScore,
        riskChange: strategyDecision.riskAnalysis.riskChange,
        topOpportunity: {
          protocol: topOpp.protocol,
          asset: topOpp.asset,
          rawApy: topOpp.apy,
          adjustedApy: topOpp.adjustedApy,
          sharpeRatio: topOpp.sharpeRatio,
          riskScore: topOpp.riskScore.overall,
          warnings: topOpp.riskScore.warnings,
          positives: topOpp.riskScore.positives,
        },
      },
    };
  }

  /**
   * Convert risk tolerance to maximum risk score
   */
  private getRiskToleranceScore(): number {
    switch (this.strategy.riskTolerance) {
      case 'low': return 35;
      case 'medium': return 55;
      case 'high': return 75;
      default: return 55;
    }
  }

  /**
   * Get current portfolio (mock implementation)
   * In production, would fetch on-chain positions
   */
  private async getPortfolio(): Promise<Portfolio> {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    const solBalance = balance / 1e9;

    return {
      totalValue: solBalance * 180,
      weightedApy: 5.2,
      positions: solBalance > 0.01 ? [{
        protocol: 'native',
        asset: 'SOL',
        amount: solBalance,
        valueUsd: solBalance * 180,
        currentApy: 5.2,
        entryTime: new Date(),
      }] : [],
    };
  }

  /**
   * Get current state (for API)
   */
  getState(): AutopilotState {
    return { ...this.state };
  }

  /**
   * Get human-readable status with risk analysis
   */
  getStatusSummary(): string {
    const s = this.state;
    const lines = [
      `🤖 **Autopilot Status**`,
      `Status: ${s.isRunning ? '🟢 Running' : '🔴 Stopped'}`,
      `Last check: ${s.lastCheck ? new Date(s.lastCheck).toISOString() : 'Never'}`,
      ``,
    ];

    // Add top risk-adjusted yields
    if (s.riskAdjustedYields.length > 0) {
      lines.push(`**Top Risk-Adjusted Yields:**`);
      s.riskAdjustedYields.slice(0, 3).forEach((y, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        lines.push(`${medal} ${y.asset} (${y.protocol}): ${y.adjustedApy.toFixed(2)}% adj | Risk: ${y.riskScore.overall}/100`);
      });
      lines.push('');
    }

    lines.push(`**Latest Decision:**`);
    if (s.lastDecision) {
      lines.push(`Type: ${s.lastDecision.type}`);
      lines.push(`Confidence: ${(s.lastDecision.confidence * 100).toFixed(0)}%`);
      
      if (s.lastDecision.riskAnalysis) {
        const ra = s.lastDecision.riskAnalysis;
        lines.push(`Risk: ${ra.currentRiskScore} → ${ra.proposedRiskScore} (${ra.riskChange})`);
        if (ra.topOpportunity) {
          lines.push(`Top pick: ${ra.topOpportunity.asset} @ ${ra.topOpportunity.adjustedApy.toFixed(2)}% (Sharpe: ${ra.topOpportunity.sharpeRatio.toFixed(2)})`);
        }
      }
      
      lines.push(`Reasoning: ${s.lastDecision.reasoning.split('\n')[0]}`);
      lines.push(s.lastDecision.executed ? `✅ Executed: ${s.lastDecision.txIds?.join(', ')}` : '⏸️ Not executed');
    } else {
      lines.push('No decisions yet');
    }

    lines.push('');
    lines.push(`**Stats:**`);
    lines.push(`Total decisions: ${s.stats.totalDecisions}`);
    lines.push(`Rebalances: ${s.stats.rebalances}`);
    lines.push(`Holds: ${s.stats.holds}`);
    lines.push(`Errors: ${s.stats.errors}`);
    lines.push(`Risk-adjusted APY gained: ${s.stats.totalRiskAdjustedApyGained.toFixed(2)}%`);
    
    return lines.join('\n');
  }
}

// Utility
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}
