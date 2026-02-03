/**
 * Gas Optimization AI
 * 
 * AI-powered gas fee optimization for Solana DeFi transactions.
 * Analyzes network congestion, predicts optimal timing, and recommends
 * priority fees to minimize costs while ensuring timely execution.
 */

import { Connection } from '@solana/web3.js';

// Priority fee tiers (in microlamports per compute unit)
export const PRIORITY_TIERS = {
  economy: { name: 'Economy', multiplier: 0.5, description: 'Lowest cost, may be delayed during congestion' },
  standard: { name: 'Standard', multiplier: 1.0, description: 'Balanced cost and speed' },
  fast: { name: 'Fast', multiplier: 2.0, description: 'Priority processing, higher cost' },
  urgent: { name: 'Urgent', multiplier: 5.0, description: 'Maximum priority, highest cost' },
} as const;

export type PriorityTier = keyof typeof PRIORITY_TIERS;

export interface NetworkCongestion {
  level: 'low' | 'medium' | 'high' | 'extreme';
  score: number; // 0-100
  tps: number;
  avgSlotTime: number;
  recentPriorityFees: {
    min: number;
    median: number;
    p75: number;
    p90: number;
    max: number;
  };
  timestamp: number;
}

export interface GasRecommendation {
  tier: PriorityTier;
  priorityFee: number; // microlamports per CU
  estimatedCost: {
    lamports: number;
    sol: number;
    usd: number;
  };
  estimatedTime: string;
  confidence: number; // 0-100
  reasoning: string[];
}

export interface BatchOptimization {
  originalTxCount: number;
  optimizedTxCount: number;
  estimatedSavings: {
    lamports: number;
    sol: number;
    usd: number;
    percentage: number;
  };
  batches: TransactionBatch[];
  reasoning: string[];
}

export interface TransactionBatch {
  id: number;
  transactions: string[];
  computeUnits: number;
  priorityFee: number;
  estimatedCost: number;
}

export interface TimingRecommendation {
  bestTimes: {
    hour: number;
    dayOfWeek: string;
    congestionLevel: string;
    estimatedSavings: number; // percentage vs current
  }[];
  currentVsOptimal: {
    currentCost: number;
    optimalCost: number;
    potentialSavings: number;
  };
  reasoning: string[];
}

export interface GasAnalysis {
  network: NetworkCongestion;
  recommendation: GasRecommendation;
  timing: TimingRecommendation;
  aiInsights: string[];
}

// Historical congestion patterns (hour of day UTC -> typical congestion score)
const HISTORICAL_CONGESTION: Record<number, number> = {
  0: 25, 1: 20, 2: 15, 3: 12, 4: 10, 5: 12,
  6: 18, 7: 25, 8: 35, 9: 45, 10: 55, 11: 60,
  12: 65, 13: 70, 14: 75, 15: 80, 16: 85, 17: 80,
  18: 70, 19: 60, 20: 50, 21: 40, 22: 35, 23: 30,
};

// Day of week multipliers (0 = Sunday)
const DAY_MULTIPLIERS: Record<number, number> = {
  0: 0.7, 1: 1.0, 2: 1.1, 3: 1.1, 4: 1.2, 5: 1.0, 6: 0.8,
};

export class GasOptimizer {
  private connection: Connection;
  private solPrice: number = 180; // Default, should be fetched
  private recentAnalysis: NetworkCongestion | null = null;
  private lastFetch: number = 0;
  private cacheDuration: number = 30000; // 30 seconds

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get comprehensive gas analysis with AI recommendations
   */
  async analyze(computeUnits: number = 200000): Promise<GasAnalysis> {
    const network = await this.getNetworkCongestion();
    const recommendation = this.getRecommendation(network, computeUnits);
    const timing = this.getTimingRecommendation(network, computeUnits);
    const aiInsights = this.generateAIInsights(network, recommendation, timing);

    return {
      network,
      recommendation,
      timing,
      aiInsights,
    };
  }

  /**
   * Fetch real-time network congestion data
   */
  async getNetworkCongestion(): Promise<NetworkCongestion> {
    const now = Date.now();
    if (this.recentAnalysis && now - this.lastFetch < this.cacheDuration) {
      return this.recentAnalysis;
    }

    try {
      // Fetch recent priority fees from recent blocks
      const [perfSamples, recentFees] = await Promise.all([
        this.connection.getRecentPerformanceSamples(10),
        this.fetchRecentPriorityFees(),
      ]);

      // Calculate TPS from performance samples
      const avgTps = perfSamples.length > 0
        ? perfSamples.reduce((sum, s) => sum + s.numTransactions / s.samplePeriodSecs, 0) / perfSamples.length
        : 2000;

      // Calculate average slot time
      const avgSlotTime = perfSamples.length > 0
        ? perfSamples.reduce((sum, s) => sum + s.samplePeriodSecs / s.numSlots, 0) / perfSamples.length
        : 0.4;

      // Calculate congestion score based on TPS and priority fees
      const tpsCongestion = Math.min(100, (avgTps / 4000) * 50);
      const feeCongestion = Math.min(100, (recentFees.median / 10000) * 50);
      const score = Math.round((tpsCongestion + feeCongestion) / 2);

      const level = score < 25 ? 'low' : score < 50 ? 'medium' : score < 75 ? 'high' : 'extreme';

      this.recentAnalysis = {
        level,
        score,
        tps: Math.round(avgTps),
        avgSlotTime: parseFloat(avgSlotTime.toFixed(3)),
        recentPriorityFees: recentFees,
        timestamp: now,
      };
      this.lastFetch = now;

      return this.recentAnalysis;
    } catch (err) {
      // Return sensible defaults on error
      return {
        level: 'medium',
        score: 45,
        tps: 2000,
        avgSlotTime: 0.4,
        recentPriorityFees: {
          min: 100,
          median: 1000,
          p75: 2500,
          p90: 5000,
          max: 50000,
        },
        timestamp: now,
      };
    }
  }

  /**
   * Fetch recent priority fees from the network
   */
  private async fetchRecentPriorityFees(): Promise<NetworkCongestion['recentPriorityFees']> {
    try {
      const response = await this.connection.getRecentPrioritizationFees();
      
      if (response.length === 0) {
        return { min: 100, median: 1000, p75: 2500, p90: 5000, max: 50000 };
      }

      const fees = response
        .map(f => f.prioritizationFee)
        .filter(f => f > 0)
        .sort((a, b) => a - b);

      if (fees.length === 0) {
        return { min: 100, median: 1000, p75: 2500, p90: 5000, max: 50000 };
      }

      const percentile = (arr: number[], p: number) => {
        const idx = Math.ceil(arr.length * p) - 1;
        return arr[Math.max(0, idx)];
      };

      return {
        min: fees[0],
        median: percentile(fees, 0.5),
        p75: percentile(fees, 0.75),
        p90: percentile(fees, 0.9),
        max: fees[fees.length - 1],
      };
    } catch {
      return { min: 100, median: 1000, p75: 2500, p90: 5000, max: 50000 };
    }
  }

  /**
   * Get recommended priority fee based on network conditions
   */
  getRecommendation(
    network: NetworkCongestion,
    computeUnits: number,
    preferredTier?: PriorityTier
  ): GasRecommendation {
    // Determine optimal tier based on congestion
    let tier: PriorityTier;
    if (preferredTier) {
      tier = preferredTier;
    } else if (network.level === 'extreme') {
      tier = 'fast';
    } else if (network.level === 'high') {
      tier = 'standard';
    } else if (network.level === 'medium') {
      tier = 'economy';
    } else {
      tier = 'economy';
    }

    // Calculate priority fee based on recent network fees
    const baseFee = network.recentPriorityFees.median;
    const multiplier = PRIORITY_TIERS[tier].multiplier;
    const priorityFee = Math.round(baseFee * multiplier);

    // Calculate costs
    const baseTxFee = 5000; // 5000 lamports base fee
    const priorityCost = Math.round((priorityFee * computeUnits) / 1_000_000);
    const totalLamports = baseTxFee + priorityCost;
    const sol = totalLamports / 1e9;
    const usd = sol * this.solPrice;

    // Estimate confirmation time
    const estimatedTime = this.estimateConfirmationTime(network, tier);

    // Calculate confidence
    const confidence = this.calculateConfidence(network, tier);

    // Generate reasoning
    const reasoning = this.generateRecommendationReasoning(network, tier, priorityFee);

    return {
      tier,
      priorityFee,
      estimatedCost: {
        lamports: totalLamports,
        sol: parseFloat(sol.toFixed(9)),
        usd: parseFloat(usd.toFixed(6)),
      },
      estimatedTime,
      confidence,
      reasoning,
    };
  }

  /**
   * Optimize a batch of transactions
   */
  optimizeBatch(
    transactions: { id: string; computeUnits: number; priority?: PriorityTier }[],
    network: NetworkCongestion
  ): BatchOptimization {
    const MAX_CU_PER_TX = 1_400_000; // Solana max compute units per tx
    const reasoning: string[] = [];

    // Sort by priority (urgent first) then by compute units
    const sorted = [...transactions].sort((a, b) => {
      const priorityOrder = { urgent: 0, fast: 1, standard: 2, economy: 3 };
      const aPriority = priorityOrder[a.priority || 'standard'];
      const bPriority = priorityOrder[b.priority || 'standard'];
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.computeUnits - a.computeUnits;
    });

    // Group into batches
    const batches: TransactionBatch[] = [];
    let currentBatch: string[] = [];
    let currentCU = 0;
    let batchId = 1;

    for (const tx of sorted) {
      if (currentCU + tx.computeUnits > MAX_CU_PER_TX && currentBatch.length > 0) {
        // Finalize current batch
        const rec = this.getRecommendation(network, currentCU);
        batches.push({
          id: batchId++,
          transactions: currentBatch,
          computeUnits: currentCU,
          priorityFee: rec.priorityFee,
          estimatedCost: rec.estimatedCost.lamports,
        });
        currentBatch = [];
        currentCU = 0;
      }
      currentBatch.push(tx.id);
      currentCU += tx.computeUnits;
    }

    // Add final batch
    if (currentBatch.length > 0) {
      const rec = this.getRecommendation(network, currentCU);
      batches.push({
        id: batchId,
        transactions: currentBatch,
        computeUnits: currentCU,
        priorityFee: rec.priorityFee,
        estimatedCost: rec.estimatedCost.lamports,
      });
    }

    // Calculate savings
    const originalCost = transactions.reduce((sum, tx) => {
      const rec = this.getRecommendation(network, tx.computeUnits);
      return sum + rec.estimatedCost.lamports;
    }, 0);

    const optimizedCost = batches.reduce((sum, b) => sum + b.estimatedCost, 0);
    const savings = originalCost - optimizedCost;
    const savingsPercentage = originalCost > 0 ? (savings / originalCost) * 100 : 0;

    // Generate reasoning
    if (batches.length < transactions.length) {
      reasoning.push(`Consolidated ${transactions.length} transactions into ${batches.length} batches`);
    }
    if (savings > 0) {
      reasoning.push(`Estimated savings: ${(savings / 1e9).toFixed(6)} SOL (${savingsPercentage.toFixed(1)}%)`);
    }
    reasoning.push(`Batching reduces base transaction fees from ${transactions.length * 5000} to ${batches.length * 5000} lamports`);

    return {
      originalTxCount: transactions.length,
      optimizedTxCount: batches.length,
      estimatedSavings: {
        lamports: savings,
        sol: parseFloat((savings / 1e9).toFixed(9)),
        usd: parseFloat(((savings / 1e9) * this.solPrice).toFixed(6)),
        percentage: parseFloat(savingsPercentage.toFixed(2)),
      },
      batches,
      reasoning,
    };
  }

  /**
   * Get timing recommendations for optimal execution
   */
  getTimingRecommendation(network: NetworkCongestion, computeUnits: number): TimingRecommendation {
    const currentHour = new Date().getUTCHours();
    const currentDay = new Date().getUTCDay();
    const currentScore = network.score;

    // Find best times in next 24 hours
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times: TimingRecommendation['bestTimes'] = [];

    for (let offset = 0; offset < 24; offset++) {
      const hour = (currentHour + offset) % 24;
      const day = (currentDay + Math.floor((currentHour + offset) / 24)) % 7;
      const historicalScore = HISTORICAL_CONGESTION[hour] * DAY_MULTIPLIERS[day];
      
      if (historicalScore < currentScore * 0.7) {
        const savings = ((currentScore - historicalScore) / currentScore) * 100;
        times.push({
          hour,
          dayOfWeek: dayNames[day],
          congestionLevel: historicalScore < 25 ? 'low' : historicalScore < 50 ? 'medium' : 'high',
          estimatedSavings: parseFloat(savings.toFixed(1)),
        });
      }
    }

    // Sort by savings
    times.sort((a, b) => b.estimatedSavings - a.estimatedSavings);

    // Calculate current vs optimal costs
    const currentRec = this.getRecommendation(network, computeUnits);
    const optimalScore = Math.min(...Object.values(HISTORICAL_CONGESTION));
    const optimalNetwork = { ...network, score: optimalScore, level: 'low' as const };
    const optimalRec = this.getRecommendation(optimalNetwork, computeUnits);

    const reasoning: string[] = [];
    if (times.length > 0) {
      reasoning.push(`Network typically quieter at ${times[0].hour}:00 UTC on ${times[0].dayOfWeek}s`);
      reasoning.push(`Potential savings of ${times[0].estimatedSavings}% by waiting`);
    }
    if (currentScore > 60) {
      reasoning.push('Current network congestion is elevated - consider delaying non-urgent transactions');
    }

    return {
      bestTimes: times.slice(0, 5),
      currentVsOptimal: {
        currentCost: currentRec.estimatedCost.lamports,
        optimalCost: optimalRec.estimatedCost.lamports,
        potentialSavings: parseFloat(((1 - optimalRec.estimatedCost.lamports / currentRec.estimatedCost.lamports) * 100).toFixed(1)),
      },
      reasoning,
    };
  }

  /**
   * Generate AI insights about gas optimization
   */
  private generateAIInsights(
    network: NetworkCongestion,
    recommendation: GasRecommendation,
    timing: TimingRecommendation
  ): string[] {
    const insights: string[] = [];

    // Network state insight
    if (network.level === 'extreme') {
      insights.push('🚨 EXTREME CONGESTION: Consider delaying non-critical transactions. Priority fees are 5-10x normal levels.');
    } else if (network.level === 'high') {
      insights.push('⚠️ High network activity detected. Using Fast tier recommended for time-sensitive transactions.');
    } else if (network.level === 'low') {
      insights.push('✅ Network is quiet. Great time for batch operations or large transactions at Economy rates.');
    }

    // Cost efficiency insight
    if (recommendation.estimatedCost.usd < 0.01) {
      insights.push('💰 Transaction cost under $0.01 - Solana\'s low fees enable efficient DeFi operations.');
    }

    // Timing insight
    if (timing.currentVsOptimal.potentialSavings > 30) {
      insights.push(`⏰ Waiting for off-peak hours could save ${timing.currentVsOptimal.potentialSavings}% on fees.`);
    }

    // TPS insight
    if (network.tps > 3000) {
      insights.push(`📈 Network processing ${network.tps} TPS - high activity period.`);
    } else if (network.tps < 1000) {
      insights.push(`📉 Low network activity (${network.tps} TPS) - optimal for cost-sensitive operations.`);
    }

    // Priority fee insight
    if (network.recentPriorityFees.p90 > 10000) {
      insights.push('💸 Top 10% of transactions paying >10,000 microlamports/CU. High competition for block space.');
    }

    return insights;
  }

  /**
   * Estimate confirmation time based on tier and congestion
   */
  private estimateConfirmationTime(network: NetworkCongestion, tier: PriorityTier): string {
    const baseTime = network.avgSlotTime * 2; // 2 slots for finality

    const tierMultipliers: Record<PriorityTier, number> = {
      economy: network.level === 'extreme' ? 30 : network.level === 'high' ? 10 : 3,
      standard: network.level === 'extreme' ? 10 : network.level === 'high' ? 4 : 2,
      fast: network.level === 'extreme' ? 4 : 2,
      urgent: 1,
    };

    const estimatedSeconds = baseTime * tierMultipliers[tier];
    
    if (estimatedSeconds < 1) return '<1 second';
    if (estimatedSeconds < 60) return `~${Math.round(estimatedSeconds)} seconds`;
    return `~${Math.round(estimatedSeconds / 60)} minutes`;
  }

  /**
   * Calculate confidence in recommendation
   */
  private calculateConfidence(network: NetworkCongestion, tier: PriorityTier): number {
    // Higher confidence when network is stable and we have recent data
    let confidence = 80;

    // Reduce confidence during extreme conditions
    if (network.level === 'extreme') confidence -= 20;
    if (network.level === 'high') confidence -= 10;

    // Reduce confidence if using economy tier during congestion
    if (tier === 'economy' && network.level !== 'low') confidence -= 10;

    // Reduce confidence based on data age
    const dataAge = Date.now() - network.timestamp;
    if (dataAge > 60000) confidence -= 15;
    else if (dataAge > 30000) confidence -= 5;

    return Math.max(50, Math.min(100, confidence));
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateRecommendationReasoning(
    network: NetworkCongestion,
    tier: PriorityTier,
    priorityFee: number
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Network congestion: ${network.level} (score: ${network.score}/100)`);
    reasoning.push(`Selected tier: ${PRIORITY_TIERS[tier].name} - ${PRIORITY_TIERS[tier].description}`);
    reasoning.push(`Priority fee: ${priorityFee} microlamports/CU (based on median: ${network.recentPriorityFees.median})`);

    if (network.tps > 0) {
      reasoning.push(`Current network TPS: ${network.tps}`);
    }

    return reasoning;
  }

  /**
   * Set SOL price for USD calculations
   */
  setSolPrice(price: number) {
    this.solPrice = price;
  }

  /**
   * Get all tier options with costs
   */
  async getAllTierCosts(computeUnits: number = 200000): Promise<Record<PriorityTier, GasRecommendation>> {
    const network = await this.getNetworkCongestion();
    
    return {
      economy: this.getRecommendation(network, computeUnits, 'economy'),
      standard: this.getRecommendation(network, computeUnits, 'standard'),
      fast: this.getRecommendation(network, computeUnits, 'fast'),
      urgent: this.getRecommendation(network, computeUnits, 'urgent'),
    };
  }
}

export default GasOptimizer;
