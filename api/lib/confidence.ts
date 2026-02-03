/**
 * Confidence Scoring System (0-100)
 * 
 * THE KEY INSIGHT: Risk ≠ Confidence
 * 
 * Risk Score: "How risky is this investment?"
 * Confidence Score: "How confident are we in this analysis?"
 * 
 * A recommendation can have:
 * - High risk + High confidence: "We're very sure this is risky"
 * - Low risk + Low confidence: "This SEEMS safe but our data is incomplete"
 * - High risk + Low confidence: "Could be risky but we're not sure — avoid"
 * - Low risk + High confidence: "We're very confident this is safe — best scenario"
 * 
 * Factors that affect confidence:
 * 1. Data Freshness - How recent is our yield data?
 * 2. Data Completeness - Do we have all key metrics?
 * 3. Source Agreement - Do multiple sources agree?
 * 4. Protocol Knowledge - Is this a well-understood protocol?
 * 5. Market Stability - Are conditions stable enough for predictions?
 * 6. Historical Accuracy - How accurate have our past analyses been?
 */

// ============================================================================
// Types
// ============================================================================

export interface ConfidenceScore {
  overall: number;              // 0-100, higher = more confident
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';  // Letter grade for quick reading
  interpretation: string;       // Human-readable summary
  factors: ConfidenceFactors;
  flags: ConfidenceFlag[];      // Things that boosted or hurt confidence
  recommendations: string[];    // Actions to improve confidence if low
  timestamp: number;
}

export interface ConfidenceFactors {
  dataFreshness: FactorScore;      // How recent is the data?
  dataCompleteness: FactorScore;   // Do we have all needed fields?
  sourceAgreement: FactorScore;    // Do sources agree?
  protocolKnowledge: FactorScore;  // Is this protocol well-understood?
  marketStability: FactorScore;    // Are markets stable?
  historicalAccuracy: FactorScore; // Past prediction accuracy
}

export interface FactorScore {
  score: number;        // 0-100
  weight: number;       // How much this factor matters (0-1)
  reason: string;       // Why this score
  details?: string[];   // Additional context
}

export interface ConfidenceFlag {
  type: 'boost' | 'penalty';
  impact: number;      // Points added/subtracted
  factor: string;      // Which factor
  reason: string;
}

// Input data for confidence calculation
export interface ConfidenceInput {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  
  // Data quality indicators
  dataTimestamp?: number;        // When was data fetched?
  dataSource?: string;           // Primary source
  alternativeSources?: {         // Other sources for comparison
    source: string;
    apy: number;
    tvl: number;
  }[];
  
  // Completeness indicators
  hasApyBreakdown?: boolean;     // Do we know base vs reward APY?
  hasHistoricalData?: boolean;   // Do we have APY history?
  hasAuditInfo?: boolean;        // Do we know audit status?
  hasTvlHistory?: boolean;       // Do we have TVL trend?
  
  // Protocol knowledge
  isKnownProtocol?: boolean;
  protocolLaunchDate?: string;
  hasBeenAnalyzedBefore?: boolean;
  previousAnalysisAccuracy?: number; // 0-1 if available
  
  // Market conditions
  marketVolatility?: 'low' | 'medium' | 'high';
  recentPriceChange24h?: number; // % change in underlying asset
}

// ============================================================================
// Main Scoring Function
// ============================================================================

export function calculateConfidenceScore(input: ConfidenceInput): ConfidenceScore {
  const flags: ConfidenceFlag[] = [];
  const recommendations: string[] = [];
  
  // Calculate each factor
  const dataFreshness = calculateDataFreshness(input, flags, recommendations);
  const dataCompleteness = calculateDataCompleteness(input, flags, recommendations);
  const sourceAgreement = calculateSourceAgreement(input, flags, recommendations);
  const protocolKnowledge = calculateProtocolKnowledge(input, flags, recommendations);
  const marketStability = calculateMarketStability(input, flags, recommendations);
  const historicalAccuracy = calculateHistoricalAccuracy(input, flags, recommendations);
  
  const factors: ConfidenceFactors = {
    dataFreshness,
    dataCompleteness,
    sourceAgreement,
    protocolKnowledge,
    marketStability,
    historicalAccuracy,
  };
  
  // Calculate weighted overall score
  let overall = 0;
  let totalWeight = 0;
  
  for (const [, factor] of Object.entries(factors)) {
    overall += factor.score * factor.weight;
    totalWeight += factor.weight;
  }
  
  overall = Math.round(overall / totalWeight);
  
  // Apply flag adjustments
  const flagAdjustment = flags.reduce((sum, f) => sum + (f.type === 'boost' ? f.impact : -f.impact), 0);
  overall = Math.max(0, Math.min(100, overall + flagAdjustment));
  
  // Determine grade
  const grade = getConfidenceGrade(overall);
  
  // Generate interpretation
  const interpretation = getInterpretation(overall, factors, input);
  
  return {
    overall,
    grade,
    interpretation,
    factors,
    flags,
    recommendations,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Factor Calculations
// ============================================================================

function calculateDataFreshness(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.20;
  let score = 50; // Default if no timestamp
  const details: string[] = [];
  
  if (input.dataTimestamp) {
    const ageMs = Date.now() - input.dataTimestamp;
    const ageMinutes = ageMs / (1000 * 60);
    const ageHours = ageMinutes / 60;
    
    if (ageMinutes < 5) {
      score = 100;
      details.push('Data is fresh (< 5 minutes old)');
    } else if (ageMinutes < 15) {
      score = 90;
      details.push(`Data is ${Math.round(ageMinutes)} minutes old`);
    } else if (ageMinutes < 60) {
      score = 75;
      details.push(`Data is ${Math.round(ageMinutes)} minutes old`);
    } else if (ageHours < 6) {
      score = 60;
      details.push(`Data is ${Math.round(ageHours)} hours old`);
      recommendations.push('Consider refreshing yield data for more accurate analysis');
    } else if (ageHours < 24) {
      score = 40;
      details.push(`Data is ${Math.round(ageHours)} hours old - stale`);
      flags.push({
        type: 'penalty',
        impact: 5,
        factor: 'dataFreshness',
        reason: 'Data older than 6 hours may not reflect current conditions',
      });
      recommendations.push('Yield data is stale - refresh before making decisions');
    } else {
      score = 20;
      details.push(`Data is ${Math.round(ageHours)} hours old - very stale`);
      flags.push({
        type: 'penalty',
        impact: 10,
        factor: 'dataFreshness',
        reason: 'Data older than 24 hours is unreliable for DeFi',
      });
      recommendations.push('⚠️ Data is outdated - refresh immediately before acting');
    }
  } else {
    details.push('No timestamp available - assuming moderately fresh');
    recommendations.push('Track data timestamps for better confidence scoring');
  }
  
  return {
    score,
    weight,
    reason: details[0] || 'Data freshness unknown',
    details,
  };
}

function calculateDataCompleteness(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.20;
  let score = 40; // Base score for having basic data (apy, tvl)
  const details: string[] = [];
  
  // Required fields (already have if we got here)
  score += 10; // APY present
  score += 10; // TVL present
  details.push('Basic metrics present (APY, TVL)');
  
  // Optional but valuable fields
  if (input.hasApyBreakdown) {
    score += 15;
    details.push('APY breakdown available (base vs rewards)');
    flags.push({
      type: 'boost',
      impact: 3,
      factor: 'dataCompleteness',
      reason: 'APY breakdown helps assess sustainability',
    });
  } else {
    recommendations.push('Get APY breakdown (base vs reward) for sustainability analysis');
  }
  
  if (input.hasHistoricalData) {
    score += 10;
    details.push('Historical APY data available');
  } else {
    recommendations.push('Historical data would help predict APY stability');
  }
  
  if (input.hasAuditInfo) {
    score += 10;
    details.push('Audit information available');
  } else {
    recommendations.push('Verify protocol audit status');
  }
  
  if (input.hasTvlHistory) {
    score += 5;
    details.push('TVL trend data available');
  }
  
  score = Math.min(100, score);
  
  if (score < 50) {
    flags.push({
      type: 'penalty',
      impact: 5,
      factor: 'dataCompleteness',
      reason: 'Missing key data points reduces analysis accuracy',
    });
  }
  
  return {
    score,
    weight,
    reason: `${Math.round(score / 10)}/10 data fields available`,
    details,
  };
}

function calculateSourceAgreement(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.15;
  let score = 60; // Default if no alternative sources
  const details: string[] = [];
  
  if (!input.alternativeSources || input.alternativeSources.length === 0) {
    details.push('Single source - cannot verify');
    recommendations.push('Cross-reference with additional sources (DeFiLlama, protocol API)');
    return { score, weight, reason: 'Single data source', details };
  }
  
  // Check APY agreement
  const apyValues = [input.apy, ...input.alternativeSources.map(s => s.apy)];
  const avgApy = apyValues.reduce((a, b) => a + b, 0) / apyValues.length;
  const apyVariance = apyValues.reduce((sum, v) => sum + Math.pow(v - avgApy, 2), 0) / apyValues.length;
  const apyStdDev = Math.sqrt(apyVariance);
  const apyCoeffVar = avgApy > 0 ? apyStdDev / avgApy : 1;
  
  // Check TVL agreement
  const tvlValues = [input.tvl, ...input.alternativeSources.map(s => s.tvl)];
  const avgTvl = tvlValues.reduce((a, b) => a + b, 0) / tvlValues.length;
  const tvlVariance = tvlValues.reduce((sum, v) => sum + Math.pow(v - avgTvl, 2), 0) / tvlValues.length;
  const tvlStdDev = Math.sqrt(tvlVariance);
  const tvlCoeffVar = avgTvl > 0 ? tvlStdDev / avgTvl : 1;
  
  details.push(`Comparing ${apyValues.length} sources`);
  
  // APY agreement scoring
  if (apyCoeffVar < 0.05) {
    score = 95;
    details.push('APY: Excellent agreement (< 5% variance)');
    flags.push({
      type: 'boost',
      impact: 5,
      factor: 'sourceAgreement',
      reason: 'Multiple sources strongly agree on APY',
    });
  } else if (apyCoeffVar < 0.15) {
    score = 80;
    details.push('APY: Good agreement (< 15% variance)');
  } else if (apyCoeffVar < 0.30) {
    score = 60;
    details.push('APY: Moderate agreement (< 30% variance)');
  } else {
    score = 35;
    details.push('APY: Poor agreement (> 30% variance)');
    flags.push({
      type: 'penalty',
      impact: 10,
      factor: 'sourceAgreement',
      reason: `Sources disagree significantly on APY (${apyValues.map(v => v.toFixed(1) + '%').join(' vs ')})`,
    });
    recommendations.push('⚠️ Sources show conflicting APY data - verify manually');
  }
  
  // TVL agreement affects score too
  if (tvlCoeffVar > 0.30) {
    score -= 10;
    details.push('TVL: Sources disagree on TVL');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    reason: `${input.alternativeSources.length + 1} sources compared`,
    details,
  };
}

function calculateProtocolKnowledge(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.20;
  let score = 30; // Unknown protocol baseline
  const details: string[] = [];
  
  const knownProtocols = ['kamino', 'drift', 'jito', 'marinade', 'mango', 'orca', 'raydium', 'lulo'];
  const protocolLower = input.protocol.toLowerCase();
  
  if (knownProtocols.includes(protocolLower) || input.isKnownProtocol) {
    score = 80;
    details.push('Well-known protocol with established track record');
    
    // Bonus for protocol age
    if (input.protocolLaunchDate) {
      const ageDays = Math.floor((Date.now() - new Date(input.protocolLaunchDate).getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays > 730) {
        score = 95;
        details.push(`Protocol running for ${(ageDays / 365).toFixed(1)} years`);
        flags.push({
          type: 'boost',
          impact: 5,
          factor: 'protocolKnowledge',
          reason: 'Battle-tested protocol with long operational history',
        });
      } else if (ageDays > 365) {
        score = 85;
        details.push(`Protocol running for ${(ageDays / 365).toFixed(1)} years`);
      }
    }
  } else {
    details.push('Unknown or new protocol - limited analysis history');
    flags.push({
      type: 'penalty',
      impact: 10,
      factor: 'protocolKnowledge',
      reason: 'Limited historical data on this protocol',
    });
    recommendations.push('Research protocol history, team, and security practices');
    recommendations.push('Start with small position to build confidence');
  }
  
  if (input.hasBeenAnalyzedBefore) {
    score += 10;
    details.push('Protocol previously analyzed in our system');
  }
  
  return {
    score: Math.min(100, score),
    weight,
    reason: details[0] || 'Protocol familiarity assessment',
    details,
  };
}

function calculateMarketStability(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.15;
  let score = 70; // Default moderate stability
  const details: string[] = [];
  
  // Market volatility
  if (input.marketVolatility === 'low') {
    score = 90;
    details.push('Low market volatility - predictions more reliable');
  } else if (input.marketVolatility === 'high') {
    score = 40;
    details.push('High market volatility - predictions less reliable');
    flags.push({
      type: 'penalty',
      impact: 8,
      factor: 'marketStability',
      reason: 'High volatility makes yield predictions uncertain',
    });
    recommendations.push('Consider waiting for market stability or reducing position size');
  } else {
    details.push('Moderate market conditions');
  }
  
  // Recent price movements
  if (input.recentPriceChange24h !== undefined) {
    const absChange = Math.abs(input.recentPriceChange24h);
    if (absChange > 20) {
      score -= 25;
      details.push(`Extreme 24h price movement (${input.recentPriceChange24h > 0 ? '+' : ''}${input.recentPriceChange24h.toFixed(1)}%)`);
      flags.push({
        type: 'penalty',
        impact: 10,
        factor: 'marketStability',
        reason: 'Large price swings may affect yield calculations',
      });
    } else if (absChange > 10) {
      score -= 10;
      details.push(`Significant 24h price movement (${input.recentPriceChange24h > 0 ? '+' : ''}${input.recentPriceChange24h.toFixed(1)}%)`);
    } else if (absChange < 2) {
      score += 5;
      details.push('Stable price action (< 2% 24h change)');
    }
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    weight,
    reason: details[0] || 'Market conditions assessment',
    details,
  };
}

function calculateHistoricalAccuracy(
  input: ConfidenceInput,
  flags: ConfidenceFlag[],
  recommendations: string[]
): FactorScore {
  const weight = 0.10;
  let score = 50; // Default when no history
  const details: string[] = [];
  
  if (input.previousAnalysisAccuracy !== undefined) {
    score = Math.round(input.previousAnalysisAccuracy * 100);
    
    if (score >= 80) {
      details.push(`Historical accuracy: ${score}% - excellent track record`);
      flags.push({
        type: 'boost',
        impact: 5,
        factor: 'historicalAccuracy',
        reason: 'Our past analyses of this protocol were accurate',
      });
    } else if (score >= 60) {
      details.push(`Historical accuracy: ${score}% - good track record`);
    } else {
      details.push(`Historical accuracy: ${score}% - mixed results`);
      flags.push({
        type: 'penalty',
        impact: 5,
        factor: 'historicalAccuracy',
        reason: 'Our past predictions for this protocol had some misses',
      });
      recommendations.push('Review past analysis errors to improve future accuracy');
    }
  } else {
    details.push('No historical accuracy data - first analysis');
    recommendations.push('Track prediction outcomes to build accuracy history');
  }
  
  return {
    score,
    weight,
    reason: details[0] || 'Historical accuracy assessment',
    details,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function getConfidenceGrade(score: number): ConfidenceScore['grade'] {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function getInterpretation(
  score: number,
  factors: ConfidenceFactors,
  input: ConfidenceInput
): string {
  const lowestFactor = Object.entries(factors)
    .sort(([, a], [, b]) => a.score - b.score)[0];
  
  if (score >= 85) {
    return `High confidence in ${input.asset} on ${input.protocol}. Analysis based on fresh data from multiple agreeing sources, with strong protocol knowledge.`;
  }
  
  if (score >= 70) {
    return `Good confidence in analysis. ${lowestFactor[1].reason}. Recommendation is reasonably reliable.`;
  }
  
  if (score >= 50) {
    return `Moderate confidence. ${lowestFactor[1].reason}. Consider the recommendations below to improve analysis quality.`;
  }
  
  if (score >= 35) {
    return `Low confidence in this analysis. Main concern: ${lowestFactor[1].reason}. Proceed with caution and verify independently.`;
  }
  
  return `Very low confidence. Analysis is unreliable due to: ${lowestFactor[1].reason}. Do not act on this recommendation without additional verification.`;
}

// ============================================================================
// Helper for combining with risk analysis
// ============================================================================

export interface RiskConfidenceMatrix {
  risk: { score: number; grade: string };
  confidence: { score: number; grade: string };
  recommendation: 'proceed' | 'proceed_with_caution' | 'verify_first' | 'avoid';
  explanation: string;
}

export function combineRiskAndConfidence(
  riskScore: number,
  confidenceScore: ConfidenceScore
): RiskConfidenceMatrix {
  const riskGrade = riskScore < 30 ? 'Low' : riskScore < 55 ? 'Medium' : 'High';
  
  let recommendation: RiskConfidenceMatrix['recommendation'];
  let explanation: string;
  
  if (confidenceScore.overall >= 70) {
    // High confidence in our analysis
    if (riskScore < 40) {
      recommendation = 'proceed';
      explanation = 'High confidence analysis shows low risk. Safe to proceed.';
    } else if (riskScore < 60) {
      recommendation = 'proceed_with_caution';
      explanation = 'We\'re confident in our analysis, but the opportunity has notable risks. Size appropriately.';
    } else {
      recommendation = 'proceed_with_caution';
      explanation = 'High-risk opportunity but we\'re confident in the assessment. Only for risk-tolerant strategies.';
    }
  } else if (confidenceScore.overall >= 50) {
    // Moderate confidence
    if (riskScore < 40) {
      recommendation = 'proceed_with_caution';
      explanation = 'Appears low risk but our data quality is moderate. Verify key metrics before large positions.';
    } else {
      recommendation = 'verify_first';
      explanation = 'Moderate risk combined with uncertain data. Verify independently before acting.';
    }
  } else {
    // Low confidence
    if (riskScore < 30) {
      recommendation = 'verify_first';
      explanation = 'Might be safe but our analysis is uncertain. Get better data before proceeding.';
    } else {
      recommendation = 'avoid';
      explanation = 'Low confidence in a potentially risky opportunity. Do not act without much better data.';
    }
  }
  
  return {
    risk: { score: riskScore, grade: riskGrade },
    confidence: { score: confidenceScore.overall, grade: confidenceScore.grade },
    recommendation,
    explanation,
  };
}

// Types are exported at their definitions above
