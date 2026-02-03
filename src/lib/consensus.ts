/**
 * Yield Analysis System
 * 
 * Single-agent multi-factor analysis with transparent reasoning.
 * No theatrical personas - just clear, explainable decision-making.
 * 
 * Factors considered:
 * - APY (raw yield)
 * - Risk score (protocol safety)
 * - TVL (liquidity depth)
 * - Audit status
 * - Protocol maturity
 * - APY sustainability
 */

import { YieldOpportunity } from '../types';
import { 
  RiskAdjustedOpportunity,
  analyzeOpportunities,
  sortByRiskAdjustedReturn,
  calculateRiskScore,
  PROTOCOL_PROFILES,
} from './risk';
import {
  CommitPhase,
  RevealPhase,
  ReasoningCommitment,
  ReasoningReveal,
  VerifiableAnalysis,
  revealReasoning,
} from './verifiable-reasoning';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  impact: 'positive' | 'negative' | 'neutral';
  reasoning: string;
}

export interface YieldAnalysis {
  opportunity: YieldOpportunity;
  riskAnalysis: RiskAdjustedOpportunity;
  overallScore: number; // 0-100
  decision: 'strong_approve' | 'approve' | 'neutral' | 'caution' | 'reject';
  confidence: number; // 0-1
  factors: AnalysisFactor[];
  reasoning: string[];
  thoughtStream: ThoughtStreamEntry[];
  verification?: {
    commitment: ReasoningCommitment;
    reveal: ReasoningReveal;
    verified: boolean;
    nonce?: string; // Store nonce for this specific analysis
  };
}

export interface ThoughtStreamEntry {
  timestamp: number;
  type: 'analysis' | 'concern' | 'approval' | 'conclusion';
  message: string;
}

export interface PortfolioAnalysis {
  timestamp: number;
  opportunities: YieldOpportunity[];
  analyses: YieldAnalysis[];
  topRecommendation: YieldAnalysis | null;
  thoughtStream: ThoughtStreamEntry[];
  summary: string;
  verification?: VerifiableAnalysis;
}

// Kept for backward compatibility
export interface AgentPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export interface AgentVote {
  agent: AgentPersona;
  opportunity: YieldOpportunity;
  decision: string;
  confidence: number;
  score: number;
  reasoning: string[];
}

export interface ConsensusResult {
  opportunity: YieldOpportunity;
  riskAnalysis: RiskAdjustedOpportunity;
  votes: AgentVote[];
  consensus: {
    decision: string;
    score: number;
    confidence: number;
    unanimity: boolean;
    dissent: string[];
  };
  reasoning: string[];
  thoughtStream: ThoughtStreamEntry[];
}

export interface MultiAgentAnalysis {
  timestamp: number;
  opportunities: YieldOpportunity[];
  results: ConsensusResult[];
  topRecommendation: ConsensusResult | null;
  agentAgreement: number;
  thoughtStream: ThoughtStreamEntry[];
  summary: string;
  verification?: VerifiableAnalysis;
}

// ============================================================================
// Analysis Weights
// ============================================================================

const ANALYSIS_WEIGHTS = {
  apy: 0.25,           // Raw yield matters
  riskScore: 0.30,     // Safety is paramount
  tvl: 0.15,           // Liquidity depth
  auditStatus: 0.15,   // Security verification
  protocolAge: 0.10,   // Battle-tested protocols
  sustainability: 0.05 // Is APY realistic?
};

// ============================================================================
// Core Analysis Functions
// ============================================================================

function analyzeOpportunity(opp: YieldOpportunity, riskAnalysis: RiskAdjustedOpportunity): YieldAnalysis {
  const factors: AnalysisFactor[] = [];
  const thoughts: ThoughtStreamEntry[] = [];
  const reasoning: string[] = [];
  const now = Date.now();

  // APY Analysis
  const apyScore = Math.min(100, opp.apy * 4); // 25% APY = 100 score
  const apyImpact = opp.apy > 15 ? 'positive' : opp.apy > 5 ? 'neutral' : 'negative';
  factors.push({
    name: 'APY',
    score: apyScore,
    weight: ANALYSIS_WEIGHTS.apy,
    impact: apyImpact,
    reasoning: `${opp.apy.toFixed(2)}% APY - ${apyImpact === 'positive' ? 'attractive yield' : apyImpact === 'neutral' ? 'moderate yield' : 'low yield'}`
  });
  thoughts.push({
    timestamp: now,
    type: 'analysis',
    message: `Analyzing ${opp.protocol} ${opp.asset}: ${opp.apy.toFixed(2)}% APY`
  });

  // Risk Analysis
  const riskScoreValue = riskAnalysis.riskScore.overall / 10; // Convert 0-100 to 0-10 scale
  const riskScoreForDisplay = 100 - (riskScoreValue * 10); // Lower risk = higher score
  const riskImpact = riskScoreValue < 4 ? 'positive' : riskScoreValue < 7 ? 'neutral' : 'negative';
  factors.push({
    name: 'Risk Score',
    score: Math.max(0, riskScoreForDisplay),
    weight: ANALYSIS_WEIGHTS.riskScore,
    impact: riskImpact,
    reasoning: `Risk level ${riskScoreValue.toFixed(1)}/10 - ${riskImpact === 'positive' ? 'low risk' : riskImpact === 'neutral' ? 'moderate risk' : 'high risk'}`
  });
  if (riskImpact === 'negative') {
    thoughts.push({
      timestamp: now + 1,
      type: 'concern',
      message: `⚠️ Elevated risk score (${riskScoreValue.toFixed(1)}/10) - proceed with caution`
    });
  }

  // TVL Analysis
  const tvlScore = Math.min(100, (opp.tvl / 1e8) * 10); // $1B TVL = 100 score
  const tvlImpact = opp.tvl > 100e6 ? 'positive' : opp.tvl > 10e6 ? 'neutral' : 'negative';
  factors.push({
    name: 'TVL',
    score: tvlScore,
    weight: ANALYSIS_WEIGHTS.tvl,
    impact: tvlImpact,
    reasoning: `$${(opp.tvl / 1e6).toFixed(1)}M TVL - ${tvlImpact === 'positive' ? 'deep liquidity' : tvlImpact === 'neutral' ? 'adequate liquidity' : 'shallow liquidity'}`
  });

  // Protocol Profile Analysis
  const profile = PROTOCOL_PROFILES[opp.protocol.toLowerCase()];
  
  // Audit Status
  const auditScore = profile?.audited ? 100 : 30;
  factors.push({
    name: 'Audit Status',
    score: auditScore,
    weight: ANALYSIS_WEIGHTS.auditStatus,
    impact: profile?.audited ? 'positive' : 'negative',
    reasoning: profile?.audited ? 'Audited by reputable firms' : 'No audit information available'
  });

  // Protocol Maturity (based on TVL as proxy for established protocols)
  const maturityScore = profile ? 75 : 50; // Known protocols get higher score
  factors.push({
    name: 'Protocol Maturity',
    score: maturityScore,
    weight: ANALYSIS_WEIGHTS.protocolAge,
    impact: maturityScore > 50 ? 'positive' : 'neutral',
    reasoning: profile ? 'Established protocol in Solana ecosystem' : 'Lesser-known protocol'
  });

  // APY Sustainability
  const sustainabilityScore = opp.apy < 30 ? 80 : opp.apy < 50 ? 50 : 20;
  factors.push({
    name: 'APY Sustainability',
    score: sustainabilityScore,
    weight: ANALYSIS_WEIGHTS.sustainability,
    impact: sustainabilityScore > 60 ? 'positive' : sustainabilityScore > 40 ? 'neutral' : 'negative',
    reasoning: opp.apy < 30 ? 'Sustainable yield level' : opp.apy < 50 ? 'Elevated APY - may not persist' : 'Very high APY - likely unsustainable'
  });

  // Calculate overall score
  const overallScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  
  // Determine decision
  let decision: YieldAnalysis['decision'];
  if (overallScore >= 80) decision = 'strong_approve';
  else if (overallScore >= 65) decision = 'approve';
  else if (overallScore >= 50) decision = 'neutral';
  else if (overallScore >= 35) decision = 'caution';
  else decision = 'reject';

  // Calculate confidence based on factor agreement
  const positiveFactors = factors.filter(f => f.impact === 'positive').length;
  const negativeFactors = factors.filter(f => f.impact === 'negative').length;
  const confidence = 0.5 + (Math.abs(positiveFactors - negativeFactors) / factors.length) * 0.5;

  // Generate reasoning summary
  const topPositive = factors.filter(f => f.impact === 'positive').sort((a, b) => b.weight - a.weight);
  const topNegative = factors.filter(f => f.impact === 'negative').sort((a, b) => b.weight - a.weight);
  
  if (topPositive.length > 0) {
    reasoning.push(`Strengths: ${topPositive.map(f => f.name.toLowerCase()).join(', ')}`);
  }
  if (topNegative.length > 0) {
    reasoning.push(`Concerns: ${topNegative.map(f => f.name.toLowerCase()).join(', ')}`);
  }
  reasoning.push(`Overall score: ${overallScore.toFixed(0)}/100 → ${decision.replace('_', ' ')}`);

  thoughts.push({
    timestamp: now + 2,
    type: decision.includes('approve') ? 'approval' : decision === 'reject' ? 'concern' : 'conclusion',
    message: `Decision: ${decision.replace('_', ' ').toUpperCase()} (score: ${overallScore.toFixed(0)}/100)`
  });

  return {
    opportunity: opp,
    riskAnalysis,
    overallScore,
    decision,
    confidence,
    factors,
    reasoning,
    thoughtStream: thoughts
  };
}

// ============================================================================
// Verifiable Analysis Function (with commit-reveal proof)
// ============================================================================

export async function analyzeYieldsVerifiable(
  opportunities: YieldOpportunity[],
  agentId: string = 'analyst'
): Promise<PortfolioAnalysis> {
  const timestamp = Date.now();
  const thoughtStream: ThoughtStreamEntry[] = [];
  
  thoughtStream.push({
    timestamp,
    type: 'analysis',
    message: `🔒 Starting VERIFIABLE analysis with commit-reveal proof...`
  });

  // Phase 1: COMMIT - Analyze and commit reasoning hashes (enhanced with AEGIS!)
  const commitPhase = new CommitPhase();
  const riskAnalyzed = analyzeOpportunities(opportunities);
  const sorted = sortByRiskAdjustedReturn(riskAnalyzed);
  
  const analyses: YieldAnalysis[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const ra = sorted[i];
    const opp = opportunities.find(o => o.protocol === ra.protocol && o.asset === ra.asset)!;
    const analysis = analyzeOpportunity(opp, ra);
    
    // Use unique agent ID per opportunity for proper nonce tracking
    const uniqueAgentId = `${agentId}-${i}`;
    
    // Commit reasoning BEFORE revealing
    const commitment = await commitPhase.addCommitment(uniqueAgentId, analysis.reasoning);
    
    thoughtStream.push({
      timestamp: Date.now(),
      type: 'analysis',
      message: `🔐 Committed reasoning for ${opp.protocol} ${opp.asset} (hash: ${commitment.commitHash.slice(0, 8)}...)`
    });
    
    // Store the agent ID with the analysis so we can retrieve the correct nonce later
    analysis.verification = {
      commitment,
      reveal: { agentId: uniqueAgentId, reasoning: [], nonce: '', timestamp: 0 }, // Placeholder
      verified: false,
      nonce: commitPhase.getNonce(uniqueAgentId)
    };
    
    analyses.push(analysis);
  }

  thoughtStream.push({
    timestamp: Date.now(),
    type: 'analysis',
    message: `✅ Commitment phase complete - ${analyses.length} reasoning hashes committed`
  });

  // Phase 2: REVEAL - Now reveal reasoning with proofs
  const revealPhase = new RevealPhase();
  
  for (const analysis of analyses) {
    if (!analysis.verification?.nonce) continue;
    
    const reveal = revealReasoning(
      analysis.verification.commitment.agentId,
      analysis.reasoning,
      analysis.verification.nonce
    );
    revealPhase.addReveal(reveal);
    
    // Update verification data with actual reveal
    analysis.verification.reveal = reveal;
  }

  thoughtStream.push({
    timestamp: Date.now(),
    type: 'analysis',
    message: `🔓 Reveal phase complete - reasoning disclosed with nonces`
  });

  // Phase 3: VERIFY - Cryptographically verify all reveals
  const verification = await revealPhase.verify(commitPhase.getCommitments());
  
  // Update verification status in analyses
  for (const analysis of analyses) {
    if (analysis.verification) {
      const verificationResult = verification.verifications.find(
        v => v.agentId === analysis.verification?.commitment.agentId
      );
      if (verificationResult) {
        analysis.verification.verified = verificationResult.verified;
      }
    }
  }

  thoughtStream.push({
    timestamp: Date.now(),
    type: verification.allVerified ? 'approval' : 'concern',
    message: verification.allVerified
      ? `✨ All reasoning verified - trust score: ${(verification.trustScore * 100).toFixed(0)}%`
      : `⚠️ Verification failed - trust score: ${(verification.trustScore * 100).toFixed(0)}%`
  });

  // Sort by overall score
  analyses.sort((a, b) => b.overallScore - a.overallScore);

  // Merge thought streams
  analyses.forEach(a => thoughtStream.push(...a.thoughtStream));
  thoughtStream.sort((a, b) => a.timestamp - b.timestamp);

  const topRecommendation = analyses[0] || null;

  // Generate summary with verification status
  const approved = analyses.filter(a => a.decision.includes('approve'));
  const verifiedTag = verification.allVerified ? ' ✅ VERIFIED' : ' ⚠️ UNVERIFIED';
  const summary = topRecommendation 
    ? `Top recommendation: ${topRecommendation.opportunity.protocol} ${topRecommendation.opportunity.asset} ` +
      `(${topRecommendation.opportunity.apy.toFixed(2)}% APY, score: ${topRecommendation.overallScore.toFixed(0)}/100)${verifiedTag}. ` +
      `${approved.length} of ${analyses.length} opportunities approved.`
    : 'No opportunities analyzed.';

  thoughtStream.push({
    timestamp: Date.now(),
    type: 'conclusion',
    message: summary
  });

  return {
    timestamp,
    opportunities,
    analyses,
    topRecommendation,
    thoughtStream,
    summary,
    verification
  };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export async function analyzeYields(opportunities: YieldOpportunity[]): Promise<PortfolioAnalysis> {
  const timestamp = Date.now();
  const thoughtStream: ThoughtStreamEntry[] = [];
  
  thoughtStream.push({
    timestamp,
    type: 'analysis',
    message: `Starting analysis of ${opportunities.length} yield opportunities...`
  });

  // Get risk analysis for all opportunities (enhanced with AEGIS!)
  const riskAnalyzed = analyzeOpportunities(opportunities);
  const sorted = sortByRiskAdjustedReturn(riskAnalyzed);

  // Analyze each opportunity
  const analyses: YieldAnalysis[] = sorted.map(ra => {
    const opp = opportunities.find(o => o.protocol === ra.protocol && o.asset === ra.asset)!;
    return analyzeOpportunity(opp, ra);
  });

  // Sort by overall score
  analyses.sort((a, b) => b.overallScore - a.overallScore);

  // Merge thought streams
  analyses.forEach(a => thoughtStream.push(...a.thoughtStream));
  thoughtStream.sort((a, b) => a.timestamp - b.timestamp);

  const topRecommendation = analyses[0] || null;

  // Generate summary
  const approved = analyses.filter(a => a.decision.includes('approve'));
  const summary = topRecommendation 
    ? `Top recommendation: ${topRecommendation.opportunity.protocol} ${topRecommendation.opportunity.asset} ` +
      `(${topRecommendation.opportunity.apy.toFixed(2)}% APY, score: ${topRecommendation.overallScore.toFixed(0)}/100). ` +
      `${approved.length} of ${analyses.length} opportunities approved.`
    : 'No opportunities analyzed.';

  thoughtStream.push({
    timestamp: Date.now(),
    type: 'conclusion',
    message: summary
  });

  return {
    timestamp,
    opportunities,
    analyses,
    topRecommendation,
    thoughtStream,
    summary
  };
}

// ============================================================================
// Backward Compatibility - Wraps new system in old interface
// ============================================================================

const SINGLE_AGENT: AgentPersona = {
  id: 'analyst',
  name: 'Yield Analyst',
  emoji: '🔍',
  description: 'Multi-factor yield analysis with transparent reasoning'
};

export async function runMultiAgentAnalysis(opportunities: YieldOpportunity[]): Promise<MultiAgentAnalysis> {
  const analysis = await analyzeYields(opportunities);
  
  // Convert to old format for backward compatibility
  const results: ConsensusResult[] = analysis.analyses.map(a => ({
    opportunity: a.opportunity,
    riskAnalysis: a.riskAnalysis,
    votes: [{
      agent: SINGLE_AGENT,
      opportunity: a.opportunity,
      decision: a.decision,
      confidence: a.confidence,
      score: a.overallScore,
      reasoning: a.reasoning
    }],
    consensus: {
      decision: a.decision,
      score: a.overallScore,
      confidence: a.confidence,
      unanimity: true,
      dissent: []
    },
    reasoning: a.reasoning,
    thoughtStream: a.thoughtStream
  }));

  return {
    timestamp: analysis.timestamp,
    opportunities: analysis.opportunities,
    results,
    topRecommendation: results[0] || null,
    agentAgreement: 1, // Single agent always agrees with itself
    thoughtStream: analysis.thoughtStream,
    summary: analysis.summary
  };
}

/**
 * Run verifiable multi-agent analysis with commit-reveal proof
 */
export async function runVerifiableMultiAgentAnalysis(
  opportunities: YieldOpportunity[]
): Promise<MultiAgentAnalysis> {
  const analysis = await analyzeYieldsVerifiable(opportunities);
  
  // Convert to old format for backward compatibility
  const results: ConsensusResult[] = analysis.analyses.map(a => ({
    opportunity: a.opportunity,
    riskAnalysis: a.riskAnalysis,
    votes: [{
      agent: SINGLE_AGENT,
      opportunity: a.opportunity,
      decision: a.decision,
      confidence: a.confidence,
      score: a.overallScore,
      reasoning: a.reasoning
    }],
    consensus: {
      decision: a.decision,
      score: a.overallScore,
      confidence: a.confidence,
      unanimity: true,
      dissent: []
    },
    reasoning: a.reasoning,
    thoughtStream: a.thoughtStream
  }));

  return {
    timestamp: analysis.timestamp,
    opportunities: analysis.opportunities,
    results,
    topRecommendation: results[0] || null,
    agentAgreement: 1,
    thoughtStream: analysis.thoughtStream,
    summary: analysis.summary,
    verification: analysis.verification
  };
}

// Export old names for compatibility
export const AGENT_PERSONAS = [SINGLE_AGENT];
export const runConsensusAnalysis = runMultiAgentAnalysis;
