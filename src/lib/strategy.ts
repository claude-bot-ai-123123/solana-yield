/**
 * Strategy Engine with Risk-Adjusted Recommendations
 * 
 * The key insight: highest APY ≠ best choice.
 * We optimize for risk-adjusted returns, like a Sharpe ratio for DeFi.
 */

import { Strategy, Portfolio, YieldOpportunity, RebalanceAction } from '../types';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn,
  RiskAdjustedOpportunity,
  calculateRiskScore,
} from './risk';

export interface StrategyDecision {
  actions: RebalanceAction[];
  reasoning: string[];
  riskAnalysis: {
    currentRiskScore: number;
    proposedRiskScore: number;
    riskChange: 'increased' | 'decreased' | 'unchanged';
  };
  projectedApy: number;
  projectedRiskAdjustedApy: number;
  confidence: number;
}

export class StrategyEngine {
  private strategy: Strategy;

  constructor(strategy: Strategy) {
    this.strategy = strategy;
  }

  /**
   * Calculate optimal moves using risk-adjusted analysis
   * Enhanced with AEGIS!
   */
  calculateOptimalMoves(
    portfolio: Portfolio, 
    opportunities: YieldOpportunity[]
  ): RebalanceAction[] {
    const decision = this.analyzeWithReasoning(portfolio, opportunities);
    return decision.actions;
  }

  /**
   * Full analysis with reasoning (for transparency)
   * Enhanced with AEGIS Analyst Agent risk intelligence!
   */
  analyzeWithReasoning(
    portfolio: Portfolio,
    opportunities: YieldOpportunity[]
  ): StrategyDecision {
    const actions: RebalanceAction[] = [];
    const reasoning: string[] = [];
    
    // Step 1: Analyze all opportunities with risk scoring (now enhanced with AEGIS!)
    const analyzed = analyzeOpportunities(opportunities);
    
    // Step 2: Filter by risk tolerance (but use actual risk scores, not simple categories)
    const maxRiskScore = this.getRiskToleranceScore();
    const eligible = analyzed.filter(o => o.riskScore.overall <= maxRiskScore);
    
    reasoning.push(`Filtered ${analyzed.length} opportunities down to ${eligible.length} within risk tolerance (max score: ${maxRiskScore})`);

    if (eligible.length === 0) {
      return {
        actions: [],
        reasoning: ['No opportunities within risk tolerance'],
        riskAnalysis: {
          currentRiskScore: this.getPortfolioRiskScore(portfolio, analyzed),
          proposedRiskScore: this.getPortfolioRiskScore(portfolio, analyzed),
          riskChange: 'unchanged',
        },
        projectedApy: portfolio.weightedApy,
        projectedRiskAdjustedApy: portfolio.weightedApy,
        confidence: 0.9,
      };
    }

    // Step 3: Sort by RISK-ADJUSTED returns (not raw APY!)
    const sorted = sortByRiskAdjustedReturn(eligible);
    const bestOpp = sorted[0];

    reasoning.push(`Best risk-adjusted opportunity: ${bestOpp.asset} on ${bestOpp.protocol}`);
    reasoning.push(`  Raw APY: ${bestOpp.apy.toFixed(2)}% | Risk-adjusted: ${bestOpp.adjustedApy.toFixed(2)}%`);
    reasoning.push(`  Risk score: ${bestOpp.riskScore.overall}/100 | Sharpe ratio: ${bestOpp.sharpeRatio.toFixed(2)}`);
    
    if (bestOpp.riskScore.warnings.length > 0) {
      reasoning.push(`  ⚠️ Warnings: ${bestOpp.riskScore.warnings.join('; ')}`);
    }
    if (bestOpp.riskScore.positives.length > 0) {
      reasoning.push(`  ✅ Positives: ${bestOpp.riskScore.positives.join('; ')}`);
    }

    // Step 4: Check if rebalancing is worth it (using risk-adjusted APY)
    const currentAdjustedApy = this.estimateCurrentRiskAdjustedApy(portfolio, analyzed);
    const apyImprovement = bestOpp.adjustedApy - currentAdjustedApy;
    
    reasoning.push(`Current portfolio risk-adjusted APY: ${currentAdjustedApy.toFixed(2)}%`);
    reasoning.push(`Potential improvement: ${apyImprovement.toFixed(2)}%`);

    // Higher threshold for rebalancing (gas costs, time, etc.)
    const effectiveThreshold = Math.max(
      this.strategy.rebalanceThreshold,
      1.0 // Minimum 1% improvement to justify rebalancing
    );

    if (apyImprovement < effectiveThreshold) {
      reasoning.push(`Improvement below threshold (${effectiveThreshold}%) — holding position`);
      return {
        actions: [],
        reasoning,
        riskAnalysis: {
          currentRiskScore: this.getPortfolioRiskScore(portfolio, analyzed),
          proposedRiskScore: this.getPortfolioRiskScore(portfolio, analyzed),
          riskChange: 'unchanged',
        },
        projectedApy: portfolio.weightedApy,
        projectedRiskAdjustedApy: currentAdjustedApy,
        confidence: 0.85,
      };
    }

    // Step 5: Find underperforming positions to rebalance
    for (const position of portfolio.positions) {
      // Find this position in our analyzed opportunities
      const positionOpp = analyzed.find(
        o => o.protocol === position.protocol && o.asset === position.asset
      );
      const positionAdjustedApy = positionOpp?.adjustedApy || position.currentApy;

      // Only rebalance if the improvement is significant
      if (bestOpp.adjustedApy - positionAdjustedApy >= effectiveThreshold) {
        // Check protocol concentration limits
        const targetProtocolValue = portfolio.positions
          .filter(p => p.protocol === bestOpp.protocol)
          .reduce((sum, p) => sum + p.valueUsd, 0);
        
        const newConcentration = (targetProtocolValue + position.valueUsd) / portfolio.totalValue;
        
        if (newConcentration <= this.strategy.maxProtocolConcentration) {
          actions.push({
            type: 'withdraw',
            from: {
              protocol: position.protocol,
              asset: position.asset,
              amount: position.amount,
            },
            to: {
              protocol: bestOpp.protocol,
              asset: bestOpp.asset,
              amount: position.amount,
            },
            expectedApyGain: bestOpp.adjustedApy - positionAdjustedApy,
          });
          
          reasoning.push(`→ Move ${position.asset} from ${position.protocol} to ${bestOpp.protocol}`);
          reasoning.push(`  Expected risk-adjusted APY gain: +${(bestOpp.adjustedApy - positionAdjustedApy).toFixed(2)}%`);
        } else {
          reasoning.push(`⚠️ Would exceed protocol concentration limit for ${bestOpp.protocol}`);
        }
      }
    }

    // Calculate risk changes
    const currentRiskScore = this.getPortfolioRiskScore(portfolio, analyzed);
    const proposedRiskScore = actions.length > 0 ? bestOpp.riskScore.overall : currentRiskScore;
    
    return {
      actions,
      reasoning,
      riskAnalysis: {
        currentRiskScore,
        proposedRiskScore,
        riskChange: proposedRiskScore < currentRiskScore ? 'decreased' : 
                   proposedRiskScore > currentRiskScore ? 'increased' : 'unchanged',
      },
      projectedApy: actions.length > 0 ? bestOpp.apy : portfolio.weightedApy,
      projectedRiskAdjustedApy: actions.length > 0 ? bestOpp.adjustedApy : currentAdjustedApy,
      confidence: actions.length > 0 ? 0.75 + (0.25 - bestOpp.riskScore.overall / 400) : 0.9,
    };
  }

  /**
   * Compare multiple opportunities side-by-side
   * Enhanced with AEGIS!
   */
  compareOpportunities(
    opportunities: YieldOpportunity[],
    count: number = 5
  ): { 
    ranking: RiskAdjustedOpportunity[];
    analysis: string;
  } {
    const analyzed = analyzeOpportunities(opportunities);
    const maxRiskScore = this.getRiskToleranceScore();
    const eligible = analyzed.filter(o => o.riskScore.overall <= maxRiskScore);
    const sorted = sortByRiskAdjustedReturn(eligible);
    const top = sorted.slice(0, count);

    const lines = ['**Top Risk-Adjusted Opportunities**', ''];
    
    top.forEach((opp, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lines.push(`${medal} **${opp.asset}** on ${opp.protocol} (${opp.recommendation.toUpperCase()})`);
      lines.push(`   APY: ${opp.apy.toFixed(2)}% raw → ${opp.adjustedApy.toFixed(2)}% risk-adjusted`);
      lines.push(`   Risk: ${opp.riskScore.overall}/100 | Sharpe: ${opp.sharpeRatio.toFixed(2)} | TVL: $${formatNumber(opp.tvl)}`);
      if (opp.riskScore.warnings.length > 0) {
        lines.push(`   ⚠️ ${opp.riskScore.warnings[0]}`);
      }
      lines.push('');
    });

    return {
      ranking: top,
      analysis: lines.join('\n'),
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
   * Estimate portfolio's current risk-adjusted APY
   */
  private estimateCurrentRiskAdjustedApy(
    portfolio: Portfolio,
    analyzed: RiskAdjustedOpportunity[]
  ): number {
    if (portfolio.totalValue === 0 || portfolio.positions.length === 0) {
      return 0;
    }

    let weightedRiskAdjustedApy = 0;
    let totalWeight = 0;

    for (const pos of portfolio.positions) {
      const matching = analyzed.find(
        o => o.protocol === pos.protocol && o.asset === pos.asset
      );
      const weight = pos.valueUsd / portfolio.totalValue;
      const riskAdjustedApy = matching?.adjustedApy || pos.currentApy * 0.7; // Assume 30% risk discount if unknown
      
      weightedRiskAdjustedApy += riskAdjustedApy * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedRiskAdjustedApy / totalWeight : 0;
  }

  /**
   * Calculate portfolio's weighted risk score
   */
  private getPortfolioRiskScore(
    portfolio: Portfolio,
    analyzed: RiskAdjustedOpportunity[]
  ): number {
    if (portfolio.totalValue === 0 || portfolio.positions.length === 0) {
      return 0;
    }

    let weightedRisk = 0;
    let totalWeight = 0;

    for (const pos of portfolio.positions) {
      const matching = analyzed.find(
        o => o.protocol === pos.protocol && o.asset === pos.asset
      );
      const weight = pos.valueUsd / portfolio.totalValue;
      const riskScore = matching?.riskScore.overall || 50; // Default if unknown
      
      weightedRisk += riskScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedRisk / totalWeight) : 0;
  }

  /**
   * Legacy method for backwards compatibility
   */
  private isWithinRiskTolerance(risk: 'low' | 'medium' | 'high'): boolean {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    return riskLevels[risk] <= riskLevels[this.strategy.riskTolerance];
  }
}

// Utility
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}
