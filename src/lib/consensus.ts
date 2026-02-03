/**
 * Multi-Agent Yield Consensus System
 * 
 * THE DIFFERENTIATOR: Multiple AI agents vote on strategies.
 * Trust through consensus, not blind faith in a single algorithm.
 * 
 * Each agent has different:
 * - Risk tolerance
 * - Analysis methodology
 * - Weight priorities (TVL vs APY vs audits, etc.)
 * 
 * The consensus mechanism:
 * 1. Each agent analyzes opportunities independently
 * 2. Each agent votes (approve/caution/reject) with confidence
 * 3. Weighted consensus determines final recommendation
 * 4. All reasoning is transparent and viewable
 * 
 * Why this matters:
 * - Multiple perspectives catch blind spots
 * - Visible disagreement = informed users
 * - Trust through transparency, not authority
 */

import { YieldOpportunity } from '../types';
import { 
  RiskAdjustedOpportunity,
  analyzeOpportunities,
  sortByRiskAdjustedReturn,
  calculateRiskScore,
  PROTOCOL_PROFILES,
} from './risk';

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  specialty: string;
  riskTolerance: number; // 0-100 (higher = more risk tolerant)
  weights: {
    apy: number;          // How much does raw APY matter?
    riskScore: number;    // How much does risk score matter?
    tvl: number;          // How much does TVL matter?
    auditStatus: number;  // How much do audits matter?
    protocolAge: number;  // How much does protocol maturity matter?
    sustainability: number; // How much does APY sustainability matter?
  };
  quirks: string[]; // Unique analysis traits
}

export interface AgentVote {
  agent: AgentPersona;
  opportunity: YieldOpportunity;
  decision: 'strong_approve' | 'approve' | 'neutral' | 'caution' | 'reject';
  confidence: number; // 0-1
  score: number; // 0-100 overall score for this opportunity
  reasoning: string[];
  keyFactors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }[];
  timestamp: number;
}

export interface ConsensusResult {
  opportunity: YieldOpportunity;
  riskAnalysis: RiskAdjustedOpportunity;
  votes: AgentVote[];
  consensus: {
    decision: 'strong_approve' | 'approve' | 'neutral' | 'caution' | 'reject';
    score: number; // Weighted average score
    confidence: number; // Agreement level
    unanimity: boolean;
    dissent: string[]; // Agents who disagreed with majority
  };
  reasoning: string[];
  thoughtStream: ThoughtStreamEntry[];
}

export interface ThoughtStreamEntry {
  timestamp: number;
  agentId: string;
  agentEmoji: string;
  type: 'analysis' | 'concern' | 'approval' | 'question' | 'conclusion';
  message: string;
}

export interface MultiAgentAnalysis {
  timestamp: number;
  opportunities: YieldOpportunity[];
  results: ConsensusResult[];
  topRecommendation: ConsensusResult | null;
  agentAgreement: number; // 0-1 how much agents agreed overall
  thoughtStream: ThoughtStreamEntry[];
  summary: string;
}

// ============================================================================
// Agent Personas
// ============================================================================

const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'conservative',
    name: 'Conservative Carl',
    emoji: '🛡️',
    description: 'Safety-first analyst who prioritizes capital preservation',
    specialty: 'Risk mitigation & protocol security',
    riskTolerance: 25,
    weights: {
      apy: 0.10,
      riskScore: 0.30,
      tvl: 0.25,
      auditStatus: 0.20,
      protocolAge: 0.10,
      sustainability: 0.05,
    },
    quirks: [
      'Flags ANY protocol under 2 years old',
      'Requires multiple audits for approval',
      'Extremely cautious about TVL < $50M',
    ],
  },
  {
    id: 'yield',
    name: 'Yield Yolanda',
    emoji: '📈',
    description: 'Yield optimizer who balances returns with reasonable risk',
    specialty: 'APY analysis & reward sustainability',
    riskTolerance: 55,
    weights: {
      apy: 0.30,
      riskScore: 0.20,
      tvl: 0.15,
      auditStatus: 0.10,
      protocolAge: 0.05,
      sustainability: 0.20,
    },
    quirks: [
      'Calculates reward sustainability from emission schedule',
      'Favors organic yield over token rewards',
      'Tracks APY history for trend analysis',
    ],
  },
  {
    id: 'degen',
    name: 'DeFi Degen Dave',
    emoji: '🎰',
    description: 'High-risk, high-reward hunter who spots alpha',
    specialty: 'Emerging opportunities & yield farming',
    riskTolerance: 80,
    weights: {
      apy: 0.40,
      riskScore: 0.10,
      tvl: 0.10,
      auditStatus: 0.05,
      protocolAge: 0.05,
      sustainability: 0.30,
    },
    quirks: [
      'First to spot new high-yield farms',
      'Monitors social sentiment for rugs',
      'Always has an exit strategy',
    ],
  },
  {
    id: 'institutional',
    name: 'Institutional Irene',
    emoji: '🏛️',
    description: 'Institutional-grade analyst with strict due diligence',
    specialty: 'Compliance, audit trails & counterparty risk',
    riskTolerance: 30,
    weights: {
      apy: 0.05,
      riskScore: 0.25,
      tvl: 0.30,
      auditStatus: 0.25,
      protocolAge: 0.10,
      sustainability: 0.05,
    },
    quirks: [
      'Requires Tier-1 audit firm approval',
      'Checks team doxxing and legal structure',
      'Only considers protocols with insurance funds',
    ],
  },
  {
    id: 'macro',
    name: 'Macro Max',
    emoji: '🌍',
    description: 'Big-picture analyst who considers market cycles',
    specialty: 'Market conditions & correlation analysis',
    riskTolerance: 50,
    weights: {
      apy: 0.15,
      riskScore: 0.20,
      tvl: 0.20,
      auditStatus: 0.10,
      protocolAge: 0.15,
      sustainability: 0.20,
    },
    quirks: [
      'Adjusts recommendations based on market sentiment',
      'Considers correlation between positions',
      'Factors in broader DeFi trends',
    ],
  },
];

// ============================================================================
// Multi-Agent Consensus Engine
// ============================================================================

export class MultiAgentConsensus {
  private agents: AgentPersona[];
  private marketConditions: { sentiment: 'bullish' | 'neutral' | 'bearish'; volatility: 'low' | 'medium' | 'high' };

  constructor(
    agents?: AgentPersona[],
    marketConditions?: { sentiment: 'bullish' | 'neutral' | 'bearish'; volatility: 'low' | 'medium' | 'high' }
  ) {
    this.agents = agents || AGENT_PERSONAS;
    this.marketConditions = marketConditions || { sentiment: 'neutral', volatility: 'medium' };
  }

  /**
   * Run full multi-agent analysis on opportunities
   */
  analyze(opportunities: YieldOpportunity[]): MultiAgentAnalysis {
    const timestamp = Date.now();
    const thoughtStream: ThoughtStreamEntry[] = [];
    const results: ConsensusResult[] = [];

    // Opening thoughts
    thoughtStream.push({
      timestamp,
      agentId: 'system',
      agentEmoji: '🤖',
      type: 'analysis',
      message: `Initiating multi-agent consensus analysis on ${opportunities.length} opportunities...`,
    });

    // Risk-analyze all opportunities first
    const analyzed = analyzeOpportunities(opportunities);
    const sorted = sortByRiskAdjustedReturn(analyzed);

    // Each agent opens with their market view
    for (const agent of this.agents) {
      thoughtStream.push({
        timestamp: timestamp + Math.random() * 1000,
        agentId: agent.id,
        agentEmoji: agent.emoji,
        type: 'analysis',
        message: this.getAgentOpeningThought(agent),
      });
    }

    // Analyze top opportunities (limit for performance)
    const topOpportunities = sorted.slice(0, 10);

    for (const opp of topOpportunities) {
      const riskAnalysis = analyzed.find(a => a.protocol === opp.protocol && a.asset === opp.asset)!;
      const consensusResult = this.analyzeOpportunity(opp, riskAnalysis, thoughtStream);
      results.push(consensusResult);
    }

    // Sort by consensus score
    results.sort((a, b) => b.consensus.score - a.consensus.score);

    // Calculate overall agent agreement
    const totalAgreement = results.reduce((sum, r) => sum + r.consensus.confidence, 0);
    const agentAgreement = results.length > 0 ? totalAgreement / results.length : 0;

    // Top recommendation
    const topRecommendation = results.find(r => 
      r.consensus.decision === 'strong_approve' || r.consensus.decision === 'approve'
    ) || null;

    // Final thoughts
    if (topRecommendation) {
      for (const agent of this.agents) {
        const vote = topRecommendation.votes.find(v => v.agent.id === agent.id);
        if (vote && (vote.decision === 'strong_approve' || vote.decision === 'approve')) {
          thoughtStream.push({
            timestamp: Date.now(),
            agentId: agent.id,
            agentEmoji: agent.emoji,
            type: 'conclusion',
            message: `I'm ${vote.decision === 'strong_approve' ? 'strongly ' : ''}supporting ${topRecommendation.opportunity.asset} on ${topRecommendation.opportunity.protocol}. ${vote.reasoning[0]}`,
          });
        }
      }
    }

    // Generate summary
    const summary = this.generateSummary(results, topRecommendation, agentAgreement);

    return {
      timestamp,
      opportunities,
      results,
      topRecommendation,
      agentAgreement,
      thoughtStream: thoughtStream.sort((a, b) => a.timestamp - b.timestamp),
      summary,
    };
  }

  /**
   * Analyze single opportunity with all agents
   */
  private analyzeOpportunity(
    opp: YieldOpportunity,
    riskAnalysis: RiskAdjustedOpportunity,
    thoughtStream: ThoughtStreamEntry[]
  ): ConsensusResult {
    const votes: AgentVote[] = [];
    const timestamp = Date.now();

    // Each agent votes
    for (const agent of this.agents) {
      const vote = this.getAgentVote(agent, opp, riskAnalysis);
      votes.push(vote);

      // Add agent's key thought to stream
      const keyThought = vote.reasoning[0] || `Analyzing ${opp.asset}...`;
      thoughtStream.push({
        timestamp: timestamp + Math.random() * 500,
        agentId: agent.id,
        agentEmoji: agent.emoji,
        type: this.getThoughtType(vote.decision),
        message: keyThought,
      });

      // If there's a notable concern, add it
      const concern = vote.keyFactors.find(f => f.impact === 'negative' && f.weight > 0.2);
      if (concern) {
        thoughtStream.push({
          timestamp: timestamp + Math.random() * 500 + 100,
          agentId: agent.id,
          agentEmoji: agent.emoji,
          type: 'concern',
          message: `⚠️ ${concern.factor}`,
        });
      }
    }

    // Calculate consensus
    const consensus = this.calculateConsensus(votes);

    // Build reasoning summary
    const reasoning = this.buildConsensusReasoning(votes, consensus);

    return {
      opportunity: opp,
      riskAnalysis,
      votes,
      consensus,
      reasoning,
      thoughtStream: thoughtStream.filter(t => 
        t.message.includes(opp.asset) || t.message.includes(opp.protocol)
      ),
    };
  }

  /**
   * Get individual agent's vote on an opportunity
   */
  private getAgentVote(
    agent: AgentPersona,
    opp: YieldOpportunity,
    riskAnalysis: RiskAdjustedOpportunity
  ): AgentVote {
    const reasoning: string[] = [];
    const keyFactors: AgentVote['keyFactors'] = [];
    let score = 50; // Start neutral

    const profile = PROTOCOL_PROFILES[opp.protocol] || PROTOCOL_PROFILES['unknown'];

    // Factor 1: APY evaluation
    const apyScore = this.evaluateApy(opp.apy, agent);
    score += apyScore.delta * agent.weights.apy * 100;
    keyFactors.push({ factor: apyScore.reason, impact: apyScore.impact, weight: agent.weights.apy });
    reasoning.push(apyScore.reason);

    // Factor 2: Risk score
    const maxAcceptableRisk = agent.riskTolerance + 20;
    if (riskAnalysis.riskScore.overall > maxAcceptableRisk) {
      const penalty = (riskAnalysis.riskScore.overall - maxAcceptableRisk) / 2;
      score -= penalty * agent.weights.riskScore * 100;
      const riskReason = `Risk score ${riskAnalysis.riskScore.overall}/100 exceeds my comfort zone (max ${maxAcceptableRisk})`;
      keyFactors.push({ factor: riskReason, impact: 'negative', weight: agent.weights.riskScore });
      reasoning.push(riskReason);
    } else {
      const bonus = (maxAcceptableRisk - riskAnalysis.riskScore.overall) / 4;
      score += bonus * agent.weights.riskScore * 100;
      const riskReason = `Risk score ${riskAnalysis.riskScore.overall}/100 is within acceptable range`;
      keyFactors.push({ factor: riskReason, impact: 'positive', weight: agent.weights.riskScore });
      reasoning.push(riskReason);
    }

    // Factor 3: TVL evaluation
    const tvlScore = this.evaluateTvl(opp.tvl, agent);
    score += tvlScore.delta * agent.weights.tvl * 100;
    keyFactors.push({ factor: tvlScore.reason, impact: tvlScore.impact, weight: agent.weights.tvl });
    reasoning.push(tvlScore.reason);

    // Factor 4: Audit status
    const auditScore = this.evaluateAuditStatus(profile, agent);
    score += auditScore.delta * agent.weights.auditStatus * 100;
    keyFactors.push({ factor: auditScore.reason, impact: auditScore.impact, weight: agent.weights.auditStatus });
    if (auditScore.impact !== 'neutral') {
      reasoning.push(auditScore.reason);
    }

    // Factor 5: Protocol age
    const ageScore = this.evaluateProtocolAge(profile, agent);
    score += ageScore.delta * agent.weights.protocolAge * 100;
    keyFactors.push({ factor: ageScore.reason, impact: ageScore.impact, weight: agent.weights.protocolAge });
    if (ageScore.impact !== 'neutral') {
      reasoning.push(ageScore.reason);
    }

    // Factor 6: Sustainability
    const sustainScore = this.evaluateSustainability(opp, riskAnalysis, agent);
    score += sustainScore.delta * agent.weights.sustainability * 100;
    keyFactors.push({ factor: sustainScore.reason, impact: sustainScore.impact, weight: agent.weights.sustainability });
    if (sustainScore.impact !== 'neutral') {
      reasoning.push(sustainScore.reason);
    }

    // Agent-specific quirks
    this.applyAgentQuirks(agent, opp, profile, riskAnalysis, reasoning, keyFactors);

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine decision based on score
    const decision = this.scoreToDecision(score, agent);

    // Calculate confidence based on how clear-cut the decision is
    const confidence = Math.abs(score - 50) / 50;

    return {
      agent,
      opportunity: opp,
      decision,
      confidence,
      score,
      reasoning,
      keyFactors,
      timestamp: Date.now(),
    };
  }

  /**
   * Evaluate APY from agent's perspective
   */
  private evaluateApy(apy: number, agent: AgentPersona): { delta: number; impact: 'positive' | 'negative' | 'neutral'; reason: string } {
    if (agent.id === 'degen') {
      if (apy > 50) return { delta: 0.4, impact: 'positive', reason: `APY ${apy.toFixed(1)}% is juicy — this is what I live for` };
      if (apy > 20) return { delta: 0.2, impact: 'positive', reason: `APY ${apy.toFixed(1)}% is decent, could be better` };
      return { delta: -0.1, impact: 'negative', reason: `APY ${apy.toFixed(1)}% is boring, where's the alpha?` };
    }
    
    if (agent.id === 'conservative' || agent.id === 'institutional') {
      if (apy > 50) return { delta: -0.3, impact: 'negative', reason: `APY ${apy.toFixed(1)}% is suspiciously high — likely unsustainable` };
      if (apy > 20) return { delta: 0.1, impact: 'neutral', reason: `APY ${apy.toFixed(1)}% — checking sustainability...` };
      if (apy > 8) return { delta: 0.3, impact: 'positive', reason: `APY ${apy.toFixed(1)}% is reasonable and likely sustainable` };
      return { delta: 0.2, impact: 'positive', reason: `APY ${apy.toFixed(1)}% is conservative but stable` };
    }

    // Default (yield/macro)
    if (apy > 30) return { delta: 0.3, impact: 'positive', reason: `APY ${apy.toFixed(1)}% is attractive if sustainable` };
    if (apy > 15) return { delta: 0.2, impact: 'positive', reason: `APY ${apy.toFixed(1)}% offers good risk-adjusted return` };
    if (apy > 5) return { delta: 0.1, impact: 'neutral', reason: `APY ${apy.toFixed(1)}% is modest but stable` };
    return { delta: 0, impact: 'neutral', reason: `APY ${apy.toFixed(1)}% is below market average` };
  }

  /**
   * Evaluate TVL from agent's perspective
   */
  private evaluateTvl(tvl: number, agent: AgentPersona): { delta: number; impact: 'positive' | 'negative' | 'neutral'; reason: string } {
    const tvlStr = formatNumber(tvl);

    if (agent.id === 'institutional') {
      if (tvl < 10_000_000) return { delta: -0.5, impact: 'negative', reason: `TVL $${tvlStr} is below institutional threshold ($10M min)` };
      if (tvl < 50_000_000) return { delta: -0.2, impact: 'negative', reason: `TVL $${tvlStr} is borderline for institutional allocation` };
      if (tvl > 500_000_000) return { delta: 0.4, impact: 'positive', reason: `TVL $${tvlStr} indicates strong market confidence` };
      return { delta: 0.2, impact: 'positive', reason: `TVL $${tvlStr} is acceptable for limited exposure` };
    }

    if (agent.id === 'degen') {
      if (tvl < 1_000_000) return { delta: 0.1, impact: 'neutral', reason: `Low TVL $${tvlStr} = early opportunity but need exit plan` };
      if (tvl > 100_000_000) return { delta: 0, impact: 'neutral', reason: `High TVL $${tvlStr} — alpha already extracted by normies` };
      return { delta: 0.2, impact: 'positive', reason: `TVL $${tvlStr} — sweet spot for yield farming` };
    }

    // Default
    if (tvl < 1_000_000) return { delta: -0.3, impact: 'negative', reason: `TVL $${tvlStr} is concerning — liquidity risk` };
    if (tvl < 10_000_000) return { delta: -0.1, impact: 'negative', reason: `TVL $${tvlStr} is below optimal` };
    if (tvl > 100_000_000) return { delta: 0.3, impact: 'positive', reason: `TVL $${tvlStr} shows strong liquidity depth` };
    return { delta: 0.1, impact: 'positive', reason: `TVL $${tvlStr} is reasonable` };
  }

  /**
   * Evaluate audit status
   */
  private evaluateAuditStatus(
    profile: typeof PROTOCOL_PROFILES[string],
    agent: AgentPersona
  ): { delta: number; impact: 'positive' | 'negative' | 'neutral'; reason: string } {
    if (!profile.audited) {
      if (agent.id === 'conservative' || agent.id === 'institutional') {
        return { delta: -0.5, impact: 'negative', reason: `BLOCKER: No audit — cannot recommend` };
      }
      if (agent.id === 'degen') {
        return { delta: -0.1, impact: 'negative', reason: `No audit — higher risk but checking other factors` };
      }
      return { delta: -0.3, impact: 'negative', reason: `No audit is a significant concern` };
    }

    const tierOneAuditors = ['Trail of Bits', 'OtterSec', 'Zellic', 'Halborn', 'Neodyme'];
    const hasTierOne = profile.auditFirms?.some(f => tierOneAuditors.includes(f));
    const multipleAudits = (profile.auditFirms?.length || 0) > 1;

    if (hasTierOne && multipleAudits) {
      return { delta: 0.3, impact: 'positive', reason: `Multiple tier-1 audits (${profile.auditFirms?.join(', ')}) — excellent security posture` };
    }
    if (hasTierOne) {
      return { delta: 0.2, impact: 'positive', reason: `Audited by ${profile.auditFirms?.join(', ')}` };
    }
    return { delta: 0.1, impact: 'positive', reason: `Audited — though not by top-tier firm` };
  }

  /**
   * Evaluate protocol age
   */
  private evaluateProtocolAge(
    profile: typeof PROTOCOL_PROFILES[string],
    agent: AgentPersona
  ): { delta: number; impact: 'positive' | 'negative' | 'neutral'; reason: string } {
    const ageDays = Math.floor(
      (Date.now() - new Date(profile.launchDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const ageYears = (ageDays / 365).toFixed(1);

    if (agent.id === 'conservative' || agent.id === 'institutional') {
      if (ageDays < 365) return { delta: -0.4, impact: 'negative', reason: `Protocol only ${ageYears} years old — needs more battle-testing` };
      if (ageDays < 730) return { delta: -0.1, impact: 'neutral', reason: `Protocol age ${ageYears} years — approaching maturity` };
      return { delta: 0.2, impact: 'positive', reason: `Battle-tested protocol (${ageYears} years)` };
    }

    if (agent.id === 'degen') {
      if (ageDays < 180) return { delta: 0.1, impact: 'positive', reason: `New protocol (${ageDays} days) — early opportunity` };
      return { delta: 0, impact: 'neutral', reason: `Protocol age is fine` };
    }

    // Default
    if (ageDays < 365) return { delta: -0.2, impact: 'negative', reason: `Protocol is young (${ageYears} years)` };
    if (ageDays > 730) return { delta: 0.15, impact: 'positive', reason: `Mature protocol (${ageYears} years)` };
    return { delta: 0, impact: 'neutral', reason: `Protocol age is reasonable` };
  }

  /**
   * Evaluate sustainability
   */
  private evaluateSustainability(
    opp: YieldOpportunity,
    riskAnalysis: RiskAdjustedOpportunity,
    agent: AgentPersona
  ): { delta: number; impact: 'positive' | 'negative' | 'neutral'; reason: string } {
    const sustainabilityRisk = riskAnalysis.riskScore.factors.sustainability;

    if (agent.id === 'yield') {
      // Yolanda cares a lot about this
      if (sustainabilityRisk > 60) {
        return { delta: -0.4, impact: 'negative', reason: `APY sustainability concern (${sustainabilityRisk}/100) — likely temporary` };
      }
      if (sustainabilityRisk < 30) {
        return { delta: 0.3, impact: 'positive', reason: `APY appears sustainable (organic yield, not just token emissions)` };
      }
      return { delta: 0, impact: 'neutral', reason: `APY sustainability is moderate` };
    }

    if (sustainabilityRisk > 70) {
      return { delta: -0.2, impact: 'negative', reason: `High APY likely unsustainable` };
    }
    if (sustainabilityRisk < 25) {
      return { delta: 0.15, impact: 'positive', reason: `APY from organic sources` };
    }
    return { delta: 0, impact: 'neutral', reason: '' };
  }

  /**
   * Apply agent-specific quirks
   */
  private applyAgentQuirks(
    agent: AgentPersona,
    opp: YieldOpportunity,
    profile: typeof PROTOCOL_PROFILES[string],
    riskAnalysis: RiskAdjustedOpportunity,
    reasoning: string[],
    keyFactors: AgentVote['keyFactors']
  ): void {
    if (agent.id === 'institutional' && !profile.insuranceFund) {
      reasoning.push('⚠️ No insurance fund — limits institutional exposure');
    }

    if (agent.id === 'macro') {
      if (this.marketConditions.sentiment === 'bearish') {
        reasoning.push('🌍 Bear market conditions — favoring defensive positions');
      } else if (this.marketConditions.sentiment === 'bullish') {
        reasoning.push('🌍 Bull market conditions — comfortable with higher risk');
      }
    }

    if (agent.id === 'degen' && riskAnalysis.riskScore.warnings.length > 0) {
      reasoning.push(`🎰 Acknowledged risks: ${riskAnalysis.riskScore.warnings[0]}. But the APY tho...`);
    }
  }

  /**
   * Convert score to decision
   */
  private scoreToDecision(score: number, agent: AgentPersona): AgentVote['decision'] {
    // Adjust thresholds based on agent risk tolerance
    const riskAdjustment = (agent.riskTolerance - 50) / 100; // -0.25 to +0.30

    const thresholds = {
      strongApprove: 80 - riskAdjustment * 15,
      approve: 65 - riskAdjustment * 10,
      neutral: 45 - riskAdjustment * 5,
      caution: 30 - riskAdjustment * 5,
    };

    if (score >= thresholds.strongApprove) return 'strong_approve';
    if (score >= thresholds.approve) return 'approve';
    if (score >= thresholds.neutral) return 'neutral';
    if (score >= thresholds.caution) return 'caution';
    return 'reject';
  }

  /**
   * Calculate consensus from all votes
   */
  private calculateConsensus(votes: AgentVote[]): ConsensusResult['consensus'] {
    // Weighted average score
    const totalWeight = votes.length;
    const weightedScore = votes.reduce((sum, v) => sum + v.score, 0) / totalWeight;

    // Decision counts
    const decisionCounts: Record<AgentVote['decision'], number> = {
      strong_approve: 0,
      approve: 0,
      neutral: 0,
      caution: 0,
      reject: 0,
    };
    votes.forEach(v => decisionCounts[v.decision]++);

    // Majority decision
    const decisions = Object.entries(decisionCounts) as [AgentVote['decision'], number][];
    decisions.sort((a, b) => b[1] - a[1]);
    const majorityDecision = decisions[0][0];
    const majorityCount = decisions[0][1];

    // Unanimity
    const unanimity = majorityCount === votes.length;

    // Dissenting agents
    const dissent = votes
      .filter(v => v.decision !== majorityDecision)
      .map(v => `${v.agent.emoji} ${v.agent.name}`);

    // Confidence based on agreement
    const agreementRatio = majorityCount / votes.length;
    const avgVoteConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
    const confidence = agreementRatio * 0.6 + avgVoteConfidence * 0.4;

    return {
      decision: majorityDecision,
      score: Math.round(weightedScore),
      confidence,
      unanimity,
      dissent,
    };
  }

  /**
   * Build human-readable consensus reasoning
   */
  private buildConsensusReasoning(votes: AgentVote[], consensus: ConsensusResult['consensus']): string[] {
    const reasoning: string[] = [];

    // Unanimous vs split decision
    if (consensus.unanimity) {
      reasoning.push(`✅ **Unanimous ${consensus.decision.replace('_', ' ').toUpperCase()}** — all agents agree`);
    } else {
      reasoning.push(`📊 **Consensus: ${consensus.decision.replace('_', ' ').toUpperCase()}** (${Math.round(consensus.confidence * 100)}% agreement)`);
      if (consensus.dissent.length > 0) {
        reasoning.push(`Dissenting: ${consensus.dissent.join(', ')}`);
      }
    }

    reasoning.push('');
    reasoning.push('**Agent Breakdown:**');

    // Group by decision
    const byDecision: Record<string, AgentVote[]> = {};
    votes.forEach(v => {
      const key = v.decision;
      if (!byDecision[key]) byDecision[key] = [];
      byDecision[key].push(v);
    });

    // Show approvals first
    ['strong_approve', 'approve', 'neutral', 'caution', 'reject'].forEach(decision => {
      if (!byDecision[decision]) return;
      byDecision[decision].forEach(v => {
        const icon = decision.includes('approve') ? '👍' : decision === 'neutral' ? '🤷' : '👎';
        reasoning.push(`${v.agent.emoji} ${v.agent.name}: ${icon} ${decision.replace('_', ' ')} (score: ${v.score})`);
        if (v.reasoning[0]) {
          reasoning.push(`   → ${v.reasoning[0]}`);
        }
      });
    });

    return reasoning;
  }

  /**
   * Get agent's opening thought based on market conditions
   */
  private getAgentOpeningThought(agent: AgentPersona): string {
    const thoughts: Record<string, string[]> = {
      conservative: [
        'Starting security-first analysis. Capital preservation is priority one.',
        'Scanning for audited protocols with strong TVL...',
        'Remember: the best trade is often no trade. Let me verify everything.',
      ],
      yield: [
        'Looking for that sweet spot — good APY with reasonable risk.',
        'Checking reward sustainability and emission schedules...',
        'Time to find some real yield, not just ponzinomics.',
      ],
      degen: [
        'Alright, where\'s the alpha at? Let\'s see what\'s cooking.',
        'High risk, high reward. But always have an exit strategy.',
        'Show me the yields above 20%. I\'ll tell you if they\'re worth it.',
      ],
      institutional: [
        'Beginning institutional due diligence process.',
        'Checking audit trails, legal structures, and counterparty risk.',
        'Only tier-1 protocols with proper risk frameworks will pass my filter.',
      ],
      macro: [
        `Market sentiment: ${this.marketConditions.sentiment}. Volatility: ${this.marketConditions.volatility}. Adjusting analysis accordingly.`,
        'Considering correlation with broader market movements.',
        'Looking at this from a portfolio allocation perspective.',
      ],
    };

    const agentThoughts = thoughts[agent.id] || ['Analyzing opportunities...'];
    return agentThoughts[Math.floor(Math.random() * agentThoughts.length)];
  }

  /**
   * Map vote decision to thought type
   */
  private getThoughtType(decision: AgentVote['decision']): ThoughtStreamEntry['type'] {
    switch (decision) {
      case 'strong_approve':
      case 'approve':
        return 'approval';
      case 'caution':
      case 'reject':
        return 'concern';
      default:
        return 'analysis';
    }
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    results: ConsensusResult[],
    topRecommendation: ConsensusResult | null,
    agentAgreement: number
  ): string {
    const lines: string[] = [];

    lines.push('## 🤝 Multi-Agent Consensus Analysis');
    lines.push('');

    // Agreement level
    const agreementLevel = agentAgreement >= 0.8 ? 'High' : agentAgreement >= 0.6 ? 'Moderate' : 'Low';
    lines.push(`**Overall Agent Agreement:** ${agreementLevel} (${Math.round(agentAgreement * 100)}%)`);
    lines.push('');

    // Top recommendation
    if (topRecommendation) {
      const opp = topRecommendation.opportunity;
      const cons = topRecommendation.consensus;
      lines.push(`### 🏆 Top Recommendation`);
      lines.push(`**${opp.asset}** on **${opp.protocol}**`);
      lines.push(`- APY: ${opp.apy.toFixed(2)}%`);
      lines.push(`- Risk-adjusted APY: ${topRecommendation.riskAnalysis.adjustedApy.toFixed(2)}%`);
      lines.push(`- Consensus Score: ${cons.score}/100`);
      lines.push(`- Decision: ${cons.decision.replace('_', ' ').toUpperCase()}`);
      if (cons.unanimity) {
        lines.push(`- ✅ **Unanimous approval** from all agents`);
      } else {
        lines.push(`- Confidence: ${Math.round(cons.confidence * 100)}%`);
        if (cons.dissent.length > 0) {
          lines.push(`- Dissenting: ${cons.dissent.join(', ')}`);
        }
      }
    } else {
      lines.push('### ⚠️ No Strong Recommendations');
      lines.push('Agents did not reach consensus on any opportunities.');
    }

    lines.push('');
    lines.push('### Agent Roster');
    this.agents.forEach(agent => {
      lines.push(`${agent.emoji} **${agent.name}** — ${agent.specialty}`);
    });

    return lines.join('\n');
  }

  /**
   * Get available agents
   */
  getAgents(): AgentPersona[] {
    return [...this.agents];
  }

  /**
   * Set market conditions (affects Macro Max's analysis)
   */
  setMarketConditions(conditions: { sentiment: 'bullish' | 'neutral' | 'bearish'; volatility: 'low' | 'medium' | 'high' }): void {
    this.marketConditions = conditions;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

/**
 * Format thought stream for display
 */
export function formatThoughtStream(stream: ThoughtStreamEntry[]): string {
  const lines: string[] = ['### 💭 Agent Thought Stream', ''];
  
  stream.forEach(entry => {
    const icon = {
      analysis: '🔍',
      concern: '⚠️',
      approval: '✅',
      question: '❓',
      conclusion: '💡',
    }[entry.type];
    
    lines.push(`${entry.agentEmoji} ${icon} ${entry.message}`);
  });

  return lines.join('\n');
}

/**
 * Format consensus result for display
 */
export function formatConsensusResult(result: ConsensusResult): string {
  const lines: string[] = [];
  const opp = result.opportunity;
  const cons = result.consensus;

  lines.push(`## ${opp.asset} on ${opp.protocol}`);
  lines.push('');
  lines.push(`**APY:** ${opp.apy.toFixed(2)}% | **Risk-adjusted:** ${result.riskAnalysis.adjustedApy.toFixed(2)}%`);
  lines.push(`**TVL:** $${formatNumber(opp.tvl)} | **Risk Score:** ${result.riskAnalysis.riskScore.overall}/100`);
  lines.push('');
  
  // Consensus badge
  const badge = cons.unanimity ? '🏆 UNANIMOUS' : cons.confidence >= 0.8 ? '✅ STRONG' : cons.confidence >= 0.6 ? '📊 MODERATE' : '⚠️ MIXED';
  lines.push(`**Consensus:** ${badge} ${cons.decision.replace('_', ' ').toUpperCase()} (score: ${cons.score}/100)`);
  lines.push('');

  // Reasoning
  result.reasoning.forEach(r => lines.push(r));

  return lines.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_PERSONAS };
