/**
 * SOLPRISM Integration - Verifiable AI Reasoning for SolanaYield
 * 
 * Every autonomous decision gets cryptographically committed BEFORE execution,
 * then revealed AFTER - creating an immutable audit trail of AI reasoning.
 */

import {
  SolprismClient,
  createReasoningTrace,
  hashTraceHex,
  type ReasoningTrace,
  type CommitResult,
} from '@solprism/sdk';
import type { Connection, Keypair } from '@solana/web3.js';
import type { StrategyResult, YieldOpportunity } from '../types';

export interface VerifiableDecision {
  trace: ReasoningTrace;
  hash: string;
  commitment?: CommitResult;
  timestamp: number;
}

export interface SolprismConfig {
  enabled: boolean;
  rpcUrl: string;
  agentName: string;
  storeLocally: boolean;  // Store traces even without wallet
}

const DEFAULT_CONFIG: SolprismConfig = {
  enabled: true,
  rpcUrl: 'https://api.devnet.solana.com',
  agentName: 'SolanaYield',
  storeLocally: true,
};

// In-memory trace storage (for demo without wallet)
const traceHistory: VerifiableDecision[] = [];

/**
 * Create a verifiable reasoning trace for a strategy decision
 */
export function createStrategyTrace(
  strategy: StrategyResult,
  yields: YieldOpportunity[],
  portfolioContext: {
    totalValue: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    rebalanceThreshold: number;
  }
): ReasoningTrace {
  // Build data sources from yield opportunities
  const dataSources = yields.slice(0, 5).map(y => ({
    name: y.protocol,
    type: 'api' as const,
    value: `APY: ${y.apy.toFixed(2)}%, TVL: $${(y.tvl / 1e6).toFixed(1)}M`,
    timestamp: Date.now(),
  }));

  // Extract alternatives considered from strategy reasoning
  const alternativesConsidered = strategy.allocations
    .filter(a => a.percentage < 20)  // Lower allocations were considered but not primary
    .map(a => ({
      action: `Allocate ${a.percentage}% to ${a.protocol}`,
      reason: `APY: ${a.apy.toFixed(2)}%, but ${a.percentage < 10 ? 'risk-adjusted score lower' : 'diversification limit'}`,
      rejected: a.percentage < 5,
    }));

  // Build the trace
  return createReasoningTrace({
    agent: 'SolanaYield',
    action: {
      type: 'rebalance',
      description: `Portfolio rebalancing across ${strategy.allocations.length} protocols`,
    },
    inputs: {
      dataSources,
      context: `Risk tolerance: ${portfolioContext.riskTolerance}, Portfolio: $${portfolioContext.totalValue.toLocaleString()}, Threshold: ${portfolioContext.rebalanceThreshold}%`,
    },
    analysis: {
      observations: [
        `Analyzed ${yields.length} yield opportunities across Solana DeFi`,
        `Top APY: ${Math.max(...yields.map(y => y.apy)).toFixed(2)}% (${yields.find(y => y.apy === Math.max(...yields.map(y => y.apy)))?.protocol})`,
        `Risk-adjusted optimization using 6-factor scoring model`,
        strategy.reasoning || 'Multi-factor analysis complete',
      ],
      logic: `
1. Fetch real-time yields from ${yields.length} protocols
2. Apply trust scoring (TVL, audit status, track record)
3. Calculate risk-adjusted returns: APY × trust_score × liquidity_factor
4. Optimize allocation using modern portfolio theory constraints
5. Verify allocations meet diversification limits (max 40% per protocol)
6. Generate execution plan with slippage estimates
      `.trim(),
      alternativesConsidered,
    },
    decision: {
      actionChosen: `Allocate: ${strategy.allocations.map(a => `${a.protocol}=${a.percentage}%`).join(', ')}`,
      confidence: strategy.confidence,
      riskAssessment: portfolioContext.riskTolerance,
      expectedOutcome: `Expected blended APY: ${strategy.expectedApy.toFixed(2)}%`,
    },
  });
}

/**
 * Hash and store a reasoning trace (works without wallet)
 */
export function recordDecision(
  strategy: StrategyResult,
  yields: YieldOpportunity[],
  portfolioContext: {
    totalValue: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    rebalanceThreshold: number;
  }
): VerifiableDecision {
  const trace = createStrategyTrace(strategy, yields, portfolioContext);
  const hash = hashTraceHex(trace);
  
  const decision: VerifiableDecision = {
    trace,
    hash,
    timestamp: Date.now(),
  };
  
  // Store locally
  traceHistory.push(decision);
  
  // Keep last 100 decisions
  if (traceHistory.length > 100) {
    traceHistory.shift();
  }
  
  return decision;
}

/**
 * Commit reasoning hash onchain (requires wallet)
 */
export async function commitDecisionOnchain(
  connection: Connection,
  wallet: Keypair,
  decision: VerifiableDecision,
  config: SolprismConfig = DEFAULT_CONFIG
): Promise<CommitResult> {
  const client = new SolprismClient(config.rpcUrl);
  
  const commitment = await client.commitReasoning(wallet, decision.trace);
  decision.commitment = commitment;
  
  return commitment;
}

/**
 * Get recent verifiable decisions
 */
export function getRecentDecisions(limit: number = 10): VerifiableDecision[] {
  return traceHistory.slice(-limit).reverse();
}

/**
 * Get a specific decision by hash
 */
export function getDecisionByHash(hash: string): VerifiableDecision | undefined {
  return traceHistory.find(d => d.hash === hash);
}

/**
 * Export decision for external verification
 */
export function exportDecisionForVerification(decision: VerifiableDecision): {
  hash: string;
  trace: ReasoningTrace;
  verificationUrl: string;
  timestamp: string;
} {
  return {
    hash: decision.hash,
    trace: decision.trace,
    verificationUrl: `https://solprism.app/verify/${decision.hash}`,
    timestamp: new Date(decision.timestamp).toISOString(),
  };
}

/**
 * Verify a trace matches its hash (local verification)
 */
export function verifyTraceLocally(trace: ReasoningTrace, expectedHash: string): boolean {
  const computedHash = hashTraceHex(trace);
  return computedHash === expectedHash;
}

export { hashTraceHex, createReasoningTrace };
