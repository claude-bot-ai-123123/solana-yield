import { Strategy, Portfolio, YieldOpportunity, RebalanceAction } from '../types';

export class StrategyEngine {
  private strategy: Strategy;

  constructor(strategy: Strategy) {
    this.strategy = strategy;
  }

  calculateOptimalMoves(
    portfolio: Portfolio, 
    opportunities: YieldOpportunity[]
  ): RebalanceAction[] {
    const actions: RebalanceAction[] = [];
    
    // Filter opportunities by risk tolerance
    const eligibleOpps = opportunities.filter(o => 
      this.isWithinRiskTolerance(o.risk)
    );

    if (eligibleOpps.length === 0) return actions;

    // Find current weighted APY
    const currentApy = portfolio.weightedApy;
    const bestOpp = eligibleOpps[0];

    // Check if rebalancing is worth it
    const apyDifference = bestOpp.apy - currentApy;
    if (apyDifference < this.strategy.rebalanceThreshold) {
      return actions; // Not worth rebalancing
    }

    // Find underperforming positions
    for (const position of portfolio.positions) {
      if (position.currentApy < bestOpp.apy - this.strategy.rebalanceThreshold) {
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
              amount: position.amount, // Will be adjusted for swap
            },
            expectedApyGain: bestOpp.apy - position.currentApy,
          });
        }
      }
    }

    return actions;
  }

  private isWithinRiskTolerance(risk: 'low' | 'medium' | 'high'): boolean {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    return riskLevels[risk] <= riskLevels[this.strategy.riskTolerance];
  }
}
