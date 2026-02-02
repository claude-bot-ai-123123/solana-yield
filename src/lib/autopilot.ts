/**
 * Autopilot - Autonomous yield optimization engine
 * The "Most Agentic" feature of SolanaYield
 * 
 * Runs continuously, monitors yields, makes decisions, executes trades
 * All decisions are logged with reasoning for transparency
 */

import { Connection, Keypair } from '@solana/web3.js';
import { fetchAllSolanaYields } from './defillama';
import { StrategyEngine } from './strategy';
import { Executor } from './executor';
import { Strategy, Portfolio, YieldOpportunity, RebalanceAction } from '../types';

export interface AutopilotDecision {
  timestamp: number;
  type: 'hold' | 'rebalance' | 'enter' | 'exit';
  reasoning: string;
  confidence: number; // 0-1
  actions: RebalanceAction[];
  executed: boolean;
  txIds?: string[];
  error?: string;
}

export interface AutopilotState {
  isRunning: boolean;
  lastCheck: number | null;
  lastDecision: AutopilotDecision | null;
  decisionHistory: AutopilotDecision[];
  currentYields: YieldOpportunity[];
  portfolio: Portfolio | null;
  stats: {
    totalDecisions: number;
    rebalances: number;
    holds: number;
    errors: number;
    totalApyGained: number;
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
      portfolio: null,
      stats: {
        totalDecisions: 0,
        rebalances: 0,
        holds: 0,
        errors: 0,
        totalApyGained: 0,
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
      this.state.currentYields = yields.slice(0, 50); // Top 50

      // 2. Get current portfolio (mock for now, would fetch on-chain)
      const portfolio = await this.getPortfolio();
      this.state.portfolio = portfolio;

      // 3. Analyze and decide
      const decision = await this.analyzeAndDecide(yields, portfolio);
      
      // 4. Execute if confidence is high enough
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

      // 5. Record decision
      this.state.lastDecision = decision;
      this.state.decisionHistory.push(decision);
      this.state.stats.totalDecisions++;

      // Keep history bounded
      if (this.state.decisionHistory.length > 100) {
        this.state.decisionHistory = this.state.decisionHistory.slice(-100);
      }

      console.log(`🧠 Decision: ${decision.type} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`);
      console.log(`   Reasoning: ${decision.reasoning}`);

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
   * Core decision-making logic with explainable reasoning
   */
  private async analyzeAndDecide(
    yields: YieldOpportunity[],
    portfolio: Portfolio
  ): Promise<AutopilotDecision> {
    const timestamp = Date.now();
    const reasoning: string[] = [];
    let confidence = 0.5;

    // Filter by risk tolerance
    const eligible = yields.filter(y => {
      const riskLevels = { low: 1, medium: 2, high: 3 };
      return riskLevels[y.risk] <= riskLevels[this.strategy.riskTolerance];
    });

    reasoning.push(`Found ${eligible.length} opportunities within risk tolerance (${this.strategy.riskTolerance})`);

    if (eligible.length === 0) {
      return {
        timestamp,
        type: 'hold',
        reasoning: 'No opportunities within risk tolerance',
        confidence: 0.9,
        actions: [],
        executed: false,
      };
    }

    // Sort by APY
    const sorted = eligible.sort((a, b) => b.apy - a.apy);
    const topOpp = sorted[0];

    reasoning.push(`Best opportunity: ${topOpp.asset} at ${topOpp.apy.toFixed(2)}% APY on ${topOpp.protocol}`);

    // Compare to portfolio
    if (portfolio.totalValue === 0) {
      reasoning.push('Portfolio is empty — recommending initial entry');
      return {
        timestamp,
        type: 'enter',
        reasoning: reasoning.join('. '),
        confidence: 0.8,
        actions: [{
          type: 'deposit',
          to: {
            protocol: topOpp.protocol,
            asset: topOpp.asset,
            amount: 0, // Would be filled by user input
          },
          expectedApyGain: topOpp.apy,
        }],
        executed: false,
      };
    }

    // Calculate if rebalancing is worth it
    const apyDiff = topOpp.apy - portfolio.weightedApy;
    reasoning.push(`Current portfolio APY: ${portfolio.weightedApy.toFixed(2)}%, potential gain: ${apyDiff.toFixed(2)}%`);

    // Check rebalance threshold
    if (apyDiff < this.strategy.rebalanceThreshold) {
      reasoning.push(`APY gain below threshold (${this.strategy.rebalanceThreshold}%) — holding`);
      return {
        timestamp,
        type: 'hold',
        reasoning: reasoning.join('. '),
        confidence: 0.85,
        actions: [],
        executed: false,
      };
    }

    // Check TVL for safety
    if (topOpp.tvl < 100000) {
      reasoning.push(`TVL too low ($${topOpp.tvl.toLocaleString()}) — avoiding for safety`);
      confidence -= 0.3;
    } else {
      reasoning.push(`TVL looks healthy: $${topOpp.tvl.toLocaleString()}`);
      confidence += 0.1;
    }

    // Generate rebalance actions
    const actions = this.strategyEngine.calculateOptimalMoves(portfolio, sorted);
    
    if (actions.length === 0) {
      reasoning.push('No beneficial moves found after analysis');
      return {
        timestamp,
        type: 'hold',
        reasoning: reasoning.join('. '),
        confidence: 0.7,
        actions: [],
        executed: false,
      };
    }

    reasoning.push(`Found ${actions.length} rebalance opportunities`);
    confidence = Math.min(0.95, confidence + 0.1);

    return {
      timestamp,
      type: 'rebalance',
      reasoning: reasoning.join('. '),
      confidence,
      actions,
      executed: false,
    };
  }

  /**
   * Get current portfolio (mock implementation)
   * In production, would fetch on-chain positions
   */
  private async getPortfolio(): Promise<Portfolio> {
    // Check wallet balance
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    const solBalance = balance / 1e9;

    // Mock portfolio for demo
    return {
      totalValue: solBalance * 180, // Rough SOL price
      weightedApy: 5.2, // Assumed baseline (staking rate)
      positions: solBalance > 0.01 ? [{
        protocol: 'native',
        asset: 'SOL',
        amount: solBalance,
        valueUsd: solBalance * 180,
        currentApy: 5.2,
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
   * Get human-readable status
   */
  getStatusSummary(): string {
    const s = this.state;
    const lines = [
      `🤖 **Autopilot Status**`,
      `Status: ${s.isRunning ? '🟢 Running' : '🔴 Stopped'}`,
      `Last check: ${s.lastCheck ? new Date(s.lastCheck).toISOString() : 'Never'}`,
      ``,
      `**Latest Decision:**`,
      s.lastDecision ? [
        `Type: ${s.lastDecision.type}`,
        `Confidence: ${(s.lastDecision.confidence * 100).toFixed(0)}%`,
        `Reasoning: ${s.lastDecision.reasoning}`,
        s.lastDecision.executed ? `✅ Executed: ${s.lastDecision.txIds?.join(', ')}` : '⏸️ Not executed',
      ].join('\n') : 'No decisions yet',
      ``,
      `**Stats:**`,
      `Total decisions: ${s.stats.totalDecisions}`,
      `Rebalances: ${s.stats.rebalances}`,
      `Holds: ${s.stats.holds}`,
      `Errors: ${s.stats.errors}`,
      `Total APY gained: ${s.stats.totalApyGained.toFixed(2)}%`,
    ];
    return lines.join('\n');
  }
}
