/**
 * AEGIS Analyst Agent Integration
 * 
 * Integrates AEGIS AI risk assessment scores into SolanaYield's trust system.
 * AEGIS is a multi-agent AI swarm for Solana DeFi risk analysis.
 * 
 * @see https://colosseum.com/agent-hackathon/projects/aegis
 */

// ============================================================================
// Types
// ============================================================================

export interface AegisRiskScore {
  protocol: string;
  score: number;              // 0-100, higher = more risky
  confidence: number;         // 0-1
  timestamp: number;          // Unix timestamp
  factors: {
    smartContractRisk: number;
    liquidityRisk: number;
    governanceRisk: number;
    marketRisk: number;
    operationalRisk: number;
  };
  insights: string[];
  warnings: string[];
}

export interface AegisApiResponse {
  success: boolean;
  data?: AegisRiskScore;
  error?: string;
}

// ============================================================================
// Mock Data (for demonstration - replace with real AEGIS API when available)
// ============================================================================

const MOCK_AEGIS_SCORES: Record<string, AegisRiskScore> = {
  'kamino': {
    protocol: 'kamino',
    score: 22,
    confidence: 0.92,
    timestamp: Date.now(),
    factors: {
      smartContractRisk: 20,
      liquidityRisk: 15,
      governanceRisk: 18,
      marketRisk: 25,
      operationalRisk: 24,
    },
    insights: [
      'Multiple security audits passed (OtterSec, Halborn)',
      'Strong TVL growth trajectory ($800M+)',
      'Conservative liquidation parameters',
    ],
    warnings: [
      'Governance token concentration among early investors',
    ],
  },
  'drift': {
    protocol: 'drift',
    score: 28,
    confidence: 0.88,
    timestamp: Date.now(),
    factors: {
      smartContractRisk: 25,
      liquidityRisk: 20,
      governanceRisk: 22,
      marketRisk: 35,
      operationalRisk: 28,
    },
    insights: [
      'Battle-tested perpetuals protocol (2+ years)',
      'Insurance fund actively protecting deposits',
      'Transparent liquidation engine',
    ],
    warnings: [
      'Nov 2022 exploit history (patched)',
      'High leverage exposure in volatile markets',
    ],
  },
  'jito': {
    protocol: 'jito',
    score: 18,
    confidence: 0.90,
    timestamp: Date.now(),
    factors: {
      smartContractRisk: 15,
      liquidityRisk: 12,
      governanceRisk: 20,
      marketRisk: 22,
      operationalRisk: 21,
    },
    insights: [
      'Audited by top firms (Neodyme, OtterSec)',
      'Liquid staking with MEV rewards',
      'Growing validator set distribution',
    ],
    warnings: [
      'MEV extraction centralization concerns',
    ],
  },
  'marinade': {
    protocol: 'marinade',
    score: 12,
    confidence: 0.95,
    timestamp: Date.now(),
    factors: {
      smartContractRisk: 10,
      liquidityRisk: 8,
      governanceRisk: 12,
      marketRisk: 15,
      operationalRisk: 14,
    },
    insights: [
      'Oldest and most battle-tested LST on Solana',
      'Excellent validator diversification',
      'Strong community governance',
      'Zero historical security incidents',
    ],
    warnings: [],
  },
  'mango': {
    protocol: 'mango',
    score: 52,
    confidence: 0.85,
    timestamp: Date.now(),
    factors: {
      smartContractRisk: 55,
      liquidityRisk: 45,
      governanceRisk: 50,
      marketRisk: 58,
      operationalRisk: 52,
    },
    insights: [
      'Relaunch after v3 exploit',
      'Improved security architecture',
    ],
    warnings: [
      'Oct 2022 $114M exploit history',
      'Rebuilding trust with community',
      'Lower TVL post-incident',
    ],
  },
};

// ============================================================================
// AEGIS API Client
// ============================================================================

/**
 * Fetch AEGIS risk score for a protocol (synchronous version using mock data)
 * 
 * In production, this would call the real AEGIS API asynchronously.
 * For the hackathon demo, we use mock data synchronously.
 * 
 * @param protocol Protocol identifier (e.g., 'kamino', 'drift')
 * @returns AEGIS risk score or null if not available
 */
export function getAegisRiskScoreSync(protocol: string): AegisRiskScore | null {
  const normalizedProtocol = protocol.toLowerCase();
  return MOCK_AEGIS_SCORES[normalizedProtocol] || null;
}

/**
 * Fetch AEGIS risk score for a protocol (async version for future API integration)
 * 
 * @param protocol Protocol identifier (e.g., 'kamino', 'drift')
 * @returns AEGIS risk score or null if not available
 */
export async function getAegisRiskScore(protocol: string): Promise<AegisRiskScore | null> {
  // For now, just return the sync version
  // TODO: Replace with real AEGIS API call when available
  return getAegisRiskScoreSync(protocol);
}

/**
 * Batch fetch AEGIS risk scores for multiple protocols
 */
export async function getAegisRiskScores(protocols: string[]): Promise<Map<string, AegisRiskScore>> {
  const scores = new Map<string, AegisRiskScore>();
  
  // In production, use batch API endpoint for efficiency
  // For now, fetch sequentially
  await Promise.all(
    protocols.map(async (protocol) => {
      const score = await getAegisRiskScore(protocol);
      if (score) {
        scores.set(protocol.toLowerCase(), score);
      }
    })
  );
  
  return scores;
}

/**
 * Check if AEGIS data is fresh (less than 1 hour old)
 */
export function isAegisDataFresh(score: AegisRiskScore): boolean {
  const ONE_HOUR = 60 * 60 * 1000;
  return (Date.now() - score.timestamp) < ONE_HOUR;
}

/**
 * Combine our internal risk score with AEGIS risk score
 * 
 * Strategy: weighted average, with higher weight on AEGIS if confidence is high
 * 
 * @param internalScore Our calculated risk score (0-100)
 * @param aegisScore AEGIS risk score
 * @returns Combined risk score (0-100)
 */
export function combineRiskScores(
  internalScore: number,
  aegisScore: AegisRiskScore | null
): number {
  if (!aegisScore) {
    return internalScore; // No AEGIS data, use our score
  }
  
  if (!isAegisDataFresh(aegisScore)) {
    console.warn(`AEGIS data for ${aegisScore.protocol} is stale`);
    return internalScore; // Stale data, use our score
  }
  
  // Weight based on AEGIS confidence
  // High confidence = more weight on AEGIS
  const aegisWeight = aegisScore.confidence;
  const internalWeight = 1 - aegisWeight;
  
  const combined = (internalScore * internalWeight) + (aegisScore.score * aegisWeight);
  return Math.round(combined);
}

/**
 * Merge AEGIS insights into our risk analysis
 */
export function mergeAegisInsights(
  warnings: string[],
  positives: string[],
  aegisScore: AegisRiskScore | null
): { warnings: string[], positives: string[] } {
  if (!aegisScore) {
    return { warnings, positives };
  }
  
  const mergedWarnings = [...warnings];
  const mergedPositives = [...positives];
  
  // Add AEGIS insights
  aegisScore.warnings.forEach(w => {
    if (!mergedWarnings.includes(w)) {
      mergedWarnings.push(`🛡️ AEGIS: ${w}`);
    }
  });
  
  aegisScore.insights.forEach(i => {
    if (!mergedPositives.includes(i)) {
      mergedPositives.push(`🛡️ AEGIS: ${i}`);
    }
  });
  
  return { warnings: mergedWarnings, positives: mergedPositives };
}

// ============================================================================
// Exports
// ============================================================================

export {
  MOCK_AEGIS_SCORES, // For testing
};
