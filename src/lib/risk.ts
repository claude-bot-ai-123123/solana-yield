/**
 * Risk-Adjusted Yield Scoring Engine
 * 
 * Not just highest APY — highest risk-adjusted return.
 * Think Sharpe ratio for DeFi.
 * 
 * Key insight: A 10% APY on a battle-tested protocol with $500M TVL
 * is BETTER than 30% APY on an unaudited protocol with $1M TVL.
 */

import { YieldOpportunity } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface RiskScore {
  overall: number; // 0-100, higher = more risky
  factors: {
    smartContract: number;    // Protocol security (audits, history)
    liquidity: number;        // TVL depth, withdrawal risk
    sustainability: number;   // Is APY sustainable or likely to crash?
    counterparty: number;     // Centralization, oracle risk
    assetVolatility: number;  // Underlying asset risk
  };
  confidence: number; // How confident are we in this assessment? 0-1
  warnings: string[];
  positives: string[];
}

export interface RiskAdjustedOpportunity extends YieldOpportunity {
  riskScore: RiskScore;
  adjustedApy: number;        // APY after risk penalty
  sharpeRatio: number;        // Return per unit of risk
  recommendation: 'strong' | 'moderate' | 'weak' | 'avoid';
  reasoning: string[];
}

// ============================================================================
// Protocol Risk Profiles
// ============================================================================

interface ProtocolProfile {
  name: string;
  audited: boolean;
  auditFirms?: string[];
  launchDate: string;         // For protocol maturity
  historicalIncidents: number;
  lastIncidentDate?: string;
  centralizationRisk: 'low' | 'medium' | 'high';
  insuranceFund?: boolean;
  baseRiskScore: number;      // 0-100 baseline
}

const PROTOCOL_PROFILES: Record<string, ProtocolProfile> = {
  'kamino': {
    name: 'Kamino Finance',
    audited: true,
    auditFirms: ['OtterSec', 'Halborn'],
    launchDate: '2022-06-01',
    historicalIncidents: 0,
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 25,
  },
  'drift': {
    name: 'Drift Protocol',
    audited: true,
    auditFirms: ['OtterSec', 'Trail of Bits'],
    launchDate: '2021-11-01',
    historicalIncidents: 1, // Nov 2022 exploit
    lastIncidentDate: '2022-11-01',
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 30,
  },
  'jito': {
    name: 'Jito',
    audited: true,
    auditFirms: ['Neodyme', 'OtterSec'],
    launchDate: '2022-11-01',
    historicalIncidents: 0,
    centralizationRisk: 'medium', // MEV extraction centralization
    insuranceFund: false,
    baseRiskScore: 20,
  },
  'marinade': {
    name: 'Marinade Finance',
    audited: true,
    auditFirms: ['Neodyme', 'Kudelski'],
    launchDate: '2021-07-01',
    historicalIncidents: 0,
    centralizationRisk: 'low',
    insuranceFund: false,
    baseRiskScore: 15, // Most battle-tested LST on Solana
  },
  'mango': {
    name: 'Mango Markets',
    audited: true,
    auditFirms: ['OtterSec'],
    launchDate: '2021-08-01',
    historicalIncidents: 1, // Oct 2022 $114M exploit
    lastIncidentDate: '2022-10-01',
    centralizationRisk: 'low',
    insuranceFund: true,
    baseRiskScore: 45, // Higher due to historical exploit
  },
  // For unknown protocols
  'unknown': {
    name: 'Unknown Protocol',
    audited: false,
    launchDate: '2024-01-01',
    historicalIncidents: 0,
    centralizationRisk: 'high',
    baseRiskScore: 70,
  },
};

// ============================================================================
// Risk Scoring Functions
// ============================================================================

/**
 * Calculate comprehensive risk score for a yield opportunity
 */
export function calculateRiskScore(opp: YieldOpportunity): RiskScore {
  const profile = PROTOCOL_PROFILES[opp.protocol] || PROTOCOL_PROFILES['unknown'];
  const warnings: string[] = [];
  const positives: string[] = [];
  
  // 1. Smart Contract Risk (0-100)
  let smartContract = profile.baseRiskScore;
  
  if (!profile.audited) {
    smartContract += 30;
    warnings.push('Protocol not audited');
  } else {
    positives.push(`Audited by ${profile.auditFirms?.join(', ')}`);
  }
  
  // Time since last incident (if any)
  if (profile.historicalIncidents > 0 && profile.lastIncidentDate) {
    const daysSinceIncident = Math.floor(
      (Date.now() - new Date(profile.lastIncidentDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceIncident < 365) {
      smartContract += 20;
      warnings.push(`Security incident within past year`);
    } else if (daysSinceIncident < 730) {
      smartContract += 10;
    } else {
      positives.push('No incidents in 2+ years');
    }
  }
  
  // Protocol maturity
  const protocolAgeDays = Math.floor(
    (Date.now() - new Date(profile.launchDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (protocolAgeDays < 180) {
    smartContract += 25;
    warnings.push('Protocol less than 6 months old');
  } else if (protocolAgeDays > 730) {
    smartContract -= 10;
    positives.push('Battle-tested (2+ years)');
  }
  
  smartContract = clamp(smartContract, 0, 100);
  
  // 2. Liquidity Risk (0-100)
  let liquidity = 0;
  
  if (opp.tvl < 100_000) {
    liquidity = 90;
    warnings.push(`Very low TVL ($${formatNumber(opp.tvl)})`);
  } else if (opp.tvl < 1_000_000) {
    liquidity = 60;
    warnings.push(`Low TVL ($${formatNumber(opp.tvl)})`);
  } else if (opp.tvl < 10_000_000) {
    liquidity = 40;
  } else if (opp.tvl < 100_000_000) {
    liquidity = 20;
    positives.push(`Strong TVL ($${formatNumber(opp.tvl)})`);
  } else {
    liquidity = 10;
    positives.push(`Excellent TVL ($${formatNumber(opp.tvl)})`);
  }
  
  // 3. APY Sustainability Risk (0-100)
  let sustainability = 0;
  
  // Extremely high APY is usually unsustainable
  if (opp.apy > 100) {
    sustainability = 90;
    warnings.push(`Extremely high APY (${opp.apy.toFixed(1)}%) likely unsustainable`);
  } else if (opp.apy > 50) {
    sustainability = 70;
    warnings.push(`Very high APY may not be sustainable`);
  } else if (opp.apy > 25) {
    sustainability = 40;
  } else if (opp.apy > 10) {
    sustainability = 20;
    positives.push('APY in sustainable range');
  } else {
    sustainability = 10;
    positives.push('Conservative, sustainable APY');
  }
  
  // Check if APY is mostly from rewards (less sustainable) vs base yield
  const metadata = opp.metadata as any;
  if (metadata?.apyReward && metadata?.apyBase) {
    const rewardRatio = metadata.apyReward / (metadata.apyBase + metadata.apyReward);
    if (rewardRatio > 0.8) {
      sustainability += 20;
      warnings.push('APY heavily dependent on token rewards');
    } else if (rewardRatio < 0.3) {
      positives.push('APY mostly from organic yield');
    }
  }
  
  sustainability = clamp(sustainability, 0, 100);
  
  // 4. Counterparty Risk (0-100)
  let counterparty = 0;
  
  switch (profile.centralizationRisk) {
    case 'high':
      counterparty = 60;
      warnings.push('Centralization concerns');
      break;
    case 'medium':
      counterparty = 35;
      break;
    case 'low':
      counterparty = 15;
      positives.push('Decentralized governance');
      break;
  }
  
  if (!profile.insuranceFund) {
    counterparty += 10;
  } else {
    positives.push('Insurance fund available');
  }
  
  counterparty = clamp(counterparty, 0, 100);
  
  // 5. Asset Volatility Risk (0-100)
  let assetVolatility = 30; // Default for crypto
  
  const isStablecoin = metadata?.stablecoin || 
    opp.asset.toLowerCase().includes('usd') ||
    ['usdc', 'usdt', 'dai', 'pyusd', 'usdy'].some(s => opp.asset.toLowerCase().includes(s));
  
  if (isStablecoin) {
    assetVolatility = 10;
    positives.push('Stablecoin - low volatility');
  } else if (opp.asset.toLowerCase().includes('sol') || opp.asset.toLowerCase().includes('eth')) {
    assetVolatility = 40;
  } else if (opp.asset.toLowerCase().includes('btc')) {
    assetVolatility = 35;
  } else {
    // Unknown/altcoin tokens - higher volatility
    assetVolatility = 65;
    warnings.push('Volatile asset');
  }
  
  // Calculate overall risk (weighted average)
  const weights = {
    smartContract: 0.30,
    liquidity: 0.20,
    sustainability: 0.20,
    counterparty: 0.15,
    assetVolatility: 0.15,
  };
  
  const overall = Math.round(
    smartContract * weights.smartContract +
    liquidity * weights.liquidity +
    sustainability * weights.sustainability +
    counterparty * weights.counterparty +
    assetVolatility * weights.assetVolatility
  );
  
  // Confidence based on how much data we have
  const confidence = profile.name === 'Unknown Protocol' ? 0.4 : 0.8;
  
  return {
    overall,
    factors: {
      smartContract,
      liquidity,
      sustainability,
      counterparty,
      assetVolatility,
    },
    confidence,
    warnings,
    positives,
  };
}

/**
 * Calculate risk-adjusted APY
 * 
 * Uses a penalty function that reduces effective APY based on risk.
 * Higher risk = bigger penalty
 * 
 * Formula: adjustedAPY = rawAPY * (1 - riskPenalty)
 * where riskPenalty = riskScore / 200 (so max penalty is 50%)
 */
export function calculateRiskAdjustedApy(apy: number, riskScore: number): number {
  const riskPenalty = riskScore / 200; // 0 to 0.5
  const adjustedApy = apy * (1 - riskPenalty);
  return Math.max(0, adjustedApy);
}

/**
 * Calculate Sharpe-like ratio (return per unit of risk)
 * 
 * Higher is better — means more return for the risk taken
 * 
 * Formula: (APY - riskFreeRate) / riskScore
 */
export function calculateSharpeRatio(apy: number, riskScore: number, riskFreeRate: number = 4): number {
  // Avoid division by zero
  if (riskScore === 0) riskScore = 1;
  const excessReturn = apy - riskFreeRate;
  return excessReturn / (riskScore / 10); // Normalize risk score
}

/**
 * Get recommendation strength based on risk-adjusted metrics
 */
export function getRecommendation(
  adjustedApy: number,
  riskScore: number,
  sharpeRatio: number
): 'strong' | 'moderate' | 'weak' | 'avoid' {
  // Avoid if overall risk is too high
  if (riskScore > 70) return 'avoid';
  if (riskScore > 55) return 'weak';
  
  // Strong recommendation needs good Sharpe and decent APY
  if (sharpeRatio > 3 && adjustedApy > 8 && riskScore < 35) {
    return 'strong';
  }
  
  if (sharpeRatio > 2 && adjustedApy > 5) {
    return 'moderate';
  }
  
  if (sharpeRatio > 1 && adjustedApy > 3) {
    return 'weak';
  }
  
  return 'weak';
}

/**
 * Enhance yield opportunities with full risk analysis
 */
export function analyzeOpportunities(
  opportunities: YieldOpportunity[]
): RiskAdjustedOpportunity[] {
  return opportunities.map(opp => {
    const riskScore = calculateRiskScore(opp);
    const adjustedApy = calculateRiskAdjustedApy(opp.apy, riskScore.overall);
    const sharpeRatio = calculateSharpeRatio(opp.apy, riskScore.overall);
    const recommendation = getRecommendation(adjustedApy, riskScore.overall, sharpeRatio);
    
    const reasoning: string[] = [];
    
    // Build reasoning
    reasoning.push(`Raw APY: ${opp.apy.toFixed(2)}% → Risk-adjusted: ${adjustedApy.toFixed(2)}%`);
    reasoning.push(`Risk score: ${riskScore.overall}/100 (Sharpe: ${sharpeRatio.toFixed(2)})`);
    
    if (riskScore.positives.length > 0) {
      reasoning.push(`✅ ${riskScore.positives.join(', ')}`);
    }
    if (riskScore.warnings.length > 0) {
      reasoning.push(`⚠️ ${riskScore.warnings.join(', ')}`);
    }
    
    return {
      ...opp,
      riskScore,
      adjustedApy,
      sharpeRatio,
      recommendation,
      reasoning,
    };
  });
}

/**
 * Sort opportunities by risk-adjusted return (best first)
 */
export function sortByRiskAdjustedReturn(
  opportunities: RiskAdjustedOpportunity[]
): RiskAdjustedOpportunity[] {
  return [...opportunities].sort((a, b) => {
    // Primary: adjusted APY
    // Secondary: Sharpe ratio (for tie-breaking)
    if (Math.abs(b.adjustedApy - a.adjustedApy) > 0.5) {
      return b.adjustedApy - a.adjustedApy;
    }
    return b.sharpeRatio - a.sharpeRatio;
  });
}

/**
 * Get top recommendations with reasoning
 */
export function getTopRecommendations(
  opportunities: YieldOpportunity[],
  count: number = 5,
  maxRisk: number = 60
): RiskAdjustedOpportunity[] {
  const analyzed = analyzeOpportunities(opportunities);
  const filtered = analyzed.filter(o => o.riskScore.overall <= maxRisk);
  const sorted = sortByRiskAdjustedReturn(filtered);
  return sorted.slice(0, count);
}

// ============================================================================
// Utility Functions
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

// ============================================================================
// Exports
// ============================================================================

export { PROTOCOL_PROFILES };
