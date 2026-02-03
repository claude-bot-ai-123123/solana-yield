/**
 * What-If Scenario Simulation Engine
 * 
 * The "wow factor" feature: Let users explore alternate realities.
 * "What if I had chosen aggressive risk?" → See how the agent would have decided differently.
 * 
 * This is critical for:
 * - Trust building (users understand agent behavior)
 * - Education (learn about risk/reward tradeoffs)
 * - Confidence (see that conservative choices were intentional)
 */

import { Strategy, Portfolio, YieldOpportunity } from '../types';
import { StrategyEngine, StrategyDecision } from './strategy';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn,
  getTopRecommendations,
  RiskAdjustedOpportunity,
} from './risk';
import { DecisionRecord, DecisionContext } from './history';

// ============================================================================
// Types
// ============================================================================

export interface WhatIfScenario {
  name: string;
  description: string;
  modifiedStrategy: Partial<Strategy>;
}

export interface WhatIfResult {
  scenario: WhatIfScenario;
  originalDecision: {
    type: string;
    confidence: number;
    actions: any[];
    reasoning: string;
    riskScore: number;
    projectedApy: number;
  };
  simulatedDecision: StrategyDecision;
  comparison: {
    wouldHaveChanged: boolean;
    actionDiff: string[];
    apyDelta: number;
    riskDelta: number;
    confidenceDelta: number;
    summary: string;
    insights: string[];
    verdict: 'better' | 'worse' | 'similar' | 'riskier';
  };
  alternativeOpportunities: Array<{
    protocol: string;
    asset: string;
    rawApy: number;
    adjustedApy: number;
    riskScore: number;
    wouldHaveChosen: boolean;
    reason: string;
  }>;
}

export interface WhatIfComparison {
  originalContext: {
    timestamp: number;
    strategy: Strategy;
    portfolioValue: number;
    decisionType: string;
  };
  scenarios: WhatIfResult[];
  learnings: string[];
  recommendation: string;
}

// ============================================================================
// Predefined Scenarios (common what-ifs)
// ============================================================================

export const PREDEFINED_SCENARIOS: WhatIfScenario[] = [
  {
    name: 'aggressive',
    description: 'What if I had chosen high risk tolerance?',
    modifiedStrategy: { riskTolerance: 'high' },
  },
  {
    name: 'conservative',
    description: 'What if I had been more cautious (low risk)?',
    modifiedStrategy: { riskTolerance: 'low' },
  },
  {
    name: 'yield-hunter',
    description: 'What if I had lower rebalance threshold (more active)?',
    modifiedStrategy: { rebalanceThreshold: 0.5 },
  },
  {
    name: 'concentrated',
    description: 'What if I allowed higher protocol concentration (80%)?',
    modifiedStrategy: { maxProtocolConcentration: 0.8 },
  },
  {
    name: 'diversified',
    description: 'What if I enforced strict diversification (max 25% per protocol)?',
    modifiedStrategy: { maxProtocolConcentration: 0.25 },
  },
  {
    name: 'high-slippage',
    description: 'What if I accepted higher slippage (3%)?',
    modifiedStrategy: { maxSlippage: 0.03 },
  },
];

// ============================================================================
// What-If Simulation Engine
// ============================================================================

export class WhatIfEngine {
  /**
   * Run a what-if simulation on a historical decision
   */
  simulate(
    record: DecisionRecord,
    scenario: WhatIfScenario
  ): WhatIfResult {
    const ctx = record.context;
    const originalDecision = record.decision;
    
    // Merge scenario modifications into original strategy
    const modifiedStrategy: Strategy = {
      ...ctx.strategyConfig,
      ...scenario.modifiedStrategy,
    };
    
    // Create a new strategy engine with modified parameters
    const engine = new StrategyEngine(modifiedStrategy);
    
    // Re-analyze with original market data but new strategy
    const yields: YieldOpportunity[] = ctx.yieldSnapshot || [];
    const simulatedDecision = engine.analyzeWithReasoning(ctx.portfolioSnapshot, yields);
    
    // Analyze what opportunities would have been available
    const analyzed = analyzeOpportunities(yields);
    const maxRiskScore = this.getRiskToleranceScore(modifiedStrategy.riskTolerance);
    const eligible = analyzed.filter(o => o.riskScore.overall <= maxRiskScore);
    const sorted = sortByRiskAdjustedReturn(eligible);
    
    // Compare decisions
    const comparison = this.compareDecisions(
      originalDecision,
      simulatedDecision,
      ctx.strategyConfig,
      modifiedStrategy,
      sorted
    );
    
    // Map alternative opportunities
    const alternativeOpportunities = sorted.slice(0, 5).map(opp => {
      const wasChosen = simulatedDecision.actions.some(
        a => a.to?.protocol === opp.protocol && a.to?.asset === opp.asset
      );
      const wasOriginallyChosen = originalDecision.actions.some(
        a => a.to?.protocol === opp.protocol && a.to?.asset === opp.asset
      );
      
      return {
        protocol: opp.protocol,
        asset: opp.asset,
        rawApy: parseFloat(opp.apy.toFixed(2)),
        adjustedApy: parseFloat(opp.adjustedApy.toFixed(2)),
        riskScore: opp.riskScore.overall,
        wouldHaveChosen: wasChosen && !wasOriginallyChosen,
        reason: wasChosen 
          ? (wasOriginallyChosen ? 'Also chosen in original' : 'NEW: Would have chosen this')
          : (wasOriginallyChosen ? 'Would have skipped this' : 'Not selected in either'),
      };
    });
    
    return {
      scenario,
      originalDecision: {
        type: originalDecision.type,
        confidence: originalDecision.confidence,
        actions: originalDecision.actions,
        reasoning: originalDecision.reasoning,
        riskScore: originalDecision.riskAnalysis?.currentRiskScore || 0,
        projectedApy: record.context.portfolioSnapshot.weightedApy,
      },
      simulatedDecision,
      comparison,
      alternativeOpportunities,
    };
  }

  /**
   * Run multiple scenarios and compare
   */
  compareScenarios(
    record: DecisionRecord,
    scenarios?: WhatIfScenario[]
  ): WhatIfComparison {
    const scenariosToRun = scenarios || PREDEFINED_SCENARIOS;
    const results = scenariosToRun.map(s => this.simulate(record, s));
    
    // Extract learnings
    const learnings = this.extractLearnings(results, record);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(results, record);
    
    return {
      originalContext: {
        timestamp: record.decision.timestamp,
        strategy: record.context.strategyConfig,
        portfolioValue: record.context.portfolioSnapshot.totalValue,
        decisionType: record.decision.type,
      },
      scenarios: results,
      learnings,
      recommendation,
    };
  }

  /**
   * Simulate a custom scenario with arbitrary strategy changes
   */
  simulateCustom(
    record: DecisionRecord,
    customStrategy: Partial<Strategy>,
    scenarioName: string = 'Custom Scenario'
  ): WhatIfResult {
    const scenario: WhatIfScenario = {
      name: scenarioName.toLowerCase().replace(/\s+/g, '-'),
      description: scenarioName,
      modifiedStrategy: customStrategy,
    };
    return this.simulate(record, scenario);
  }

  /**
   * Quick what-if: Just change risk tolerance
   */
  whatIfRisk(
    record: DecisionRecord,
    riskLevel: 'low' | 'medium' | 'high'
  ): WhatIfResult {
    return this.simulateCustom(
      record,
      { riskTolerance: riskLevel },
      `What if risk was ${riskLevel}?`
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private compareDecisions(
    original: any,
    simulated: StrategyDecision,
    originalStrategy: Strategy,
    newStrategy: Strategy,
    availableOpportunities: RiskAdjustedOpportunity[]
  ): WhatIfResult['comparison'] {
    const originalActions = original.actions || [];
    const simulatedActions = simulated.actions || [];
    
    // Check if actions changed
    const wouldHaveChanged = 
      originalActions.length !== simulatedActions.length ||
      !this.actionsEqual(originalActions, simulatedActions);
    
    // Calculate deltas
    const originalRisk = original.riskAnalysis?.currentRiskScore || 50;
    const simulatedRisk = simulated.riskAnalysis.proposedRiskScore;
    const riskDelta = simulatedRisk - originalRisk;
    
    const originalApy = original.riskAnalysis?.topOpportunity?.adjustedApy || 0;
    const simulatedApy = simulated.projectedRiskAdjustedApy;
    const apyDelta = simulatedApy - originalApy;
    
    const confidenceDelta = simulated.confidence - original.confidence;
    
    // Generate action diff
    const actionDiff: string[] = [];
    if (wouldHaveChanged) {
      if (simulatedActions.length > originalActions.length) {
        actionDiff.push(`Would have taken ${simulatedActions.length - originalActions.length} more action(s)`);
      } else if (simulatedActions.length < originalActions.length) {
        actionDiff.push(`Would have taken ${originalActions.length - simulatedActions.length} fewer action(s)`);
      }
      
      // Detail the differences
      for (const sim of simulatedActions) {
        const hadOriginal = originalActions.some(
          (o: any) => o.to?.protocol === sim.to?.protocol && o.to?.asset === sim.to?.asset
        );
        if (!hadOriginal && sim.to) {
          actionDiff.push(`+ Would deposit into ${sim.to.asset} on ${sim.to.protocol}`);
        }
      }
      for (const orig of originalActions) {
        const inSimulated = simulatedActions.some(
          s => s.to?.protocol === orig.to?.protocol && s.to?.asset === orig.to?.asset
        );
        if (!inSimulated && orig.to) {
          actionDiff.push(`- Would NOT deposit into ${orig.to.asset} on ${orig.to.protocol}`);
        }
      }
    }
    
    // Generate insights
    const insights: string[] = [];
    
    if (newStrategy.riskTolerance !== originalStrategy.riskTolerance) {
      if (newStrategy.riskTolerance === 'high' && riskDelta > 10) {
        insights.push(`⚠️ Higher risk tolerance would have exposed you to ${riskDelta} points more risk`);
      }
      if (newStrategy.riskTolerance === 'low' && riskDelta < -10) {
        insights.push(`🛡️ Lower risk tolerance would have reduced risk by ${Math.abs(riskDelta)} points`);
      }
    }
    
    if (apyDelta > 2) {
      insights.push(`📈 This strategy would have yielded ${apyDelta.toFixed(1)}% more APY`);
    } else if (apyDelta < -2) {
      insights.push(`📉 This strategy would have yielded ${Math.abs(apyDelta).toFixed(1)}% less APY`);
    }
    
    if (availableOpportunities.length > 0) {
      const topOpp = availableOpportunities[0];
      if (topOpp.riskScore.overall > 60) {
        insights.push(`🎲 Top opportunity (${topOpp.asset} on ${topOpp.protocol}) has elevated risk score: ${topOpp.riskScore.overall}/100`);
      } else if (topOpp.riskScore.overall < 30) {
        insights.push(`✅ Top opportunity (${topOpp.asset} on ${topOpp.protocol}) is relatively safe: ${topOpp.riskScore.overall}/100`);
      }
    }
    
    // Determine verdict
    let verdict: 'better' | 'worse' | 'similar' | 'riskier';
    if (!wouldHaveChanged) {
      verdict = 'similar';
    } else if (apyDelta > 1 && riskDelta <= 5) {
      verdict = 'better';
    } else if (apyDelta > 1 && riskDelta > 10) {
      verdict = 'riskier';
    } else if (apyDelta < -1) {
      verdict = 'worse';
    } else {
      verdict = 'similar';
    }
    
    // Generate summary
    let summary: string;
    if (!wouldHaveChanged) {
      summary = 'The agent would have made the same decision with these parameters.';
    } else {
      const change = simulatedActions.length > 0 ? 'rebalance' : 'hold';
      summary = `The agent would have chosen to ${change}. ` +
        `APY ${apyDelta >= 0 ? '+' : ''}${apyDelta.toFixed(1)}%, ` +
        `Risk ${riskDelta >= 0 ? '+' : ''}${riskDelta} points.`;
    }
    
    return {
      wouldHaveChanged,
      actionDiff,
      apyDelta: parseFloat(apyDelta.toFixed(2)),
      riskDelta,
      confidenceDelta: parseFloat(confidenceDelta.toFixed(2)),
      summary,
      insights,
      verdict,
    };
  }

  private actionsEqual(a1: any[], a2: any[]): boolean {
    if (a1.length !== a2.length) return false;
    
    for (const action1 of a1) {
      const match = a2.find(
        a2Item => 
          a2Item.type === action1.type &&
          a2Item.to?.protocol === action1.to?.protocol &&
          a2Item.to?.asset === action1.to?.asset
      );
      if (!match) return false;
    }
    return true;
  }

  private extractLearnings(results: WhatIfResult[], record: DecisionRecord): string[] {
    const learnings: string[] = [];
    
    // Check if aggressive would have been better
    const aggressive = results.find(r => r.scenario.name === 'aggressive');
    const conservative = results.find(r => r.scenario.name === 'conservative');
    
    if (aggressive && aggressive.comparison.verdict === 'better') {
      learnings.push('📊 An aggressive strategy would have outperformed in this market condition.');
    }
    
    if (conservative && conservative.comparison.wouldHaveChanged === false) {
      learnings.push('🛡️ Conservative settings validated: the agent\'s caution was appropriate.');
    }
    
    // Check for consistent decisions across scenarios
    const unchangedCount = results.filter(r => !r.comparison.wouldHaveChanged).length;
    if (unchangedCount >= results.length * 0.7) {
      learnings.push('✅ High conviction: The decision was robust across multiple strategy variations.');
    }
    
    // Risk-reward insight
    const riskierResults = results.filter(r => r.comparison.verdict === 'riskier');
    if (riskierResults.length > 0) {
      const avgExtraApy = riskierResults.reduce((sum, r) => sum + r.comparison.apyDelta, 0) / riskierResults.length;
      const avgExtraRisk = riskierResults.reduce((sum, r) => sum + r.comparison.riskDelta, 0) / riskierResults.length;
      learnings.push(`⚖️ Risk/Reward: Taking on ${avgExtraRisk.toFixed(0)} more risk would have gained ${avgExtraApy.toFixed(1)}% APY.`);
    }
    
    return learnings;
  }

  private generateRecommendation(results: WhatIfResult[], record: DecisionRecord): string {
    const betterResults = results.filter(r => r.comparison.verdict === 'better');
    const riskierResults = results.filter(r => r.comparison.verdict === 'riskier');
    
    if (betterResults.length > 0) {
      const best = betterResults.sort((a, b) => b.comparison.apyDelta - a.comparison.apyDelta)[0];
      return `Consider: "${best.scenario.description}" would have achieved +${best.comparison.apyDelta.toFixed(1)}% APY with acceptable risk.`;
    }
    
    if (riskierResults.length > 0 && record.context.strategyConfig.riskTolerance !== 'high') {
      return 'Your current risk settings appear well-calibrated. Higher risk would have yielded more but with significant tradeoffs.';
    }
    
    return 'Your strategy is performing optimally for current market conditions. No changes recommended.';
  }

  private getRiskToleranceScore(tolerance: 'low' | 'medium' | 'high'): number {
    switch (tolerance) {
      case 'low': return 35;
      case 'medium': return 55;
      case 'high': return 75;
      default: return 55;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let whatIfEngine: WhatIfEngine | null = null;

export function getWhatIfEngine(): WhatIfEngine {
  if (!whatIfEngine) {
    whatIfEngine = new WhatIfEngine();
  }
  return whatIfEngine;
}
