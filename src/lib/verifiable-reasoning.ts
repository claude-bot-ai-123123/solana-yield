/**
 * Verifiable Reasoning System
 * 
 * Implements commit-reveal cryptographic proof for multi-agent consensus.
 * Each agent commits a reasoning hash before voting, then reveals after decision.
 * Proves independent analysis - agents cannot change reasoning after seeing others' votes.
 * 
 * Inspired by SOLPRISM's approach to transparent AI reasoning on Solana.
 */

// Use Web Crypto API for edge compatibility
const crypto = globalThis.crypto;

// ============================================================================
// Types
// ============================================================================

export interface ReasoningCommitment {
  agentId: string;
  commitHash: string;
  timestamp: number;
}

export interface ReasoningReveal {
  agentId: string;
  reasoning: string[];
  nonce: string;
  timestamp: number;
}

export interface VerificationResult {
  agentId: string;
  verified: boolean;
  commitHash: string;
  revealedHash: string;
  error?: string;
}

export interface VerifiableAnalysis {
  commitments: ReasoningCommitment[];
  reveals: ReasoningReveal[];
  verifications: VerificationResult[];
  allVerified: boolean;
  trustScore: number; // 0-1, based on verification success
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate a cryptographic nonce for commit-reveal
 */
export function generateNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using SHA-256 (Web Crypto API)
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a commitment hash from reasoning + nonce
 * Uses SHA-256 for collision resistance
 */
export async function commitReasoning(
  agentId: string,
  reasoning: string[],
  nonce: string
): Promise<ReasoningCommitment> {
  const reasoningStr = reasoning.join('|');
  const payload = `${agentId}:${reasoningStr}:${nonce}`;
  const commitHash = await sha256(payload);
  
  return {
    agentId,
    commitHash,
    timestamp: Date.now()
  };
}

/**
 * Reveal reasoning with nonce for verification
 */
export function revealReasoning(
  agentId: string,
  reasoning: string[],
  nonce: string
): ReasoningReveal {
  return {
    agentId,
    reasoning,
    nonce,
    timestamp: Date.now()
  };
}

/**
 * Verify that a reveal matches the original commitment
 */
export async function verifyReveal(
  commitment: ReasoningCommitment,
  reveal: ReasoningReveal
): Promise<VerificationResult> {
  if (commitment.agentId !== reveal.agentId) {
    return {
      agentId: reveal.agentId,
      verified: false,
      commitHash: commitment.commitHash,
      revealedHash: '',
      error: 'Agent ID mismatch'
    };
  }

  const reasoningStr = reveal.reasoning.join('|');
  const payload = `${reveal.agentId}:${reasoningStr}:${reveal.nonce}`;
  const revealedHash = await sha256(payload);
  
  const verified = revealedHash === commitment.commitHash;
  
  return {
    agentId: reveal.agentId,
    verified,
    commitHash: commitment.commitHash,
    revealedHash,
    error: verified ? undefined : 'Hash mismatch - reasoning may have been modified'
  };
}

/**
 * Verify all reveals against commitments
 */
export async function verifyAllReveals(
  commitments: ReasoningCommitment[],
  reveals: ReasoningReveal[]
): Promise<VerifiableAnalysis> {
  const verifications: VerificationResult[] = [];
  
  for (const reveal of reveals) {
    const commitment = commitments.find(c => c.agentId === reveal.agentId);
    if (!commitment) {
      verifications.push({
        agentId: reveal.agentId,
        verified: false,
        commitHash: '',
        revealedHash: '',
        error: 'No commitment found for this agent'
      });
      continue;
    }
    
    verifications.push(await verifyReveal(commitment, reveal));
  }
  
  const allVerified = verifications.every(v => v.verified);
  const trustScore = verifications.length > 0
    ? verifications.filter(v => v.verified).length / verifications.length
    : 0;
  
  return {
    commitments,
    reveals,
    verifications,
    allVerified,
    trustScore
  };
}

// ============================================================================
// Commit-Reveal Workflow Helpers
// ============================================================================

/**
 * Phase 1: All agents commit their reasoning (before seeing others' votes)
 */
export class CommitPhase {
  private commitments: ReasoningCommitment[] = [];
  private nonces: Map<string, string> = new Map();
  
  async addCommitment(
    agentId: string,
    reasoning: string[]
  ): Promise<ReasoningCommitment> {
    const nonce = generateNonce();
    this.nonces.set(agentId, nonce);
    
    const commitment = await commitReasoning(agentId, reasoning, nonce);
    this.commitments.push(commitment);
    
    return commitment;
  }
  
  getCommitments(): ReasoningCommitment[] {
    return [...this.commitments];
  }
  
  getNonce(agentId: string): string | undefined {
    return this.nonces.get(agentId);
  }
  
  isComplete(expectedAgents: number): boolean {
    return this.commitments.length === expectedAgents;
  }
}

/**
 * Phase 2: After all commitments, agents reveal their reasoning
 */
export class RevealPhase {
  private reveals: ReasoningReveal[] = [];
  
  addReveal(reveal: ReasoningReveal): void {
    this.reveals.push(reveal);
  }
  
  getReveals(): ReasoningReveal[] {
    return [...this.reveals];
  }
  
  isComplete(expectedAgents: number): boolean {
    return this.reveals.length === expectedAgents;
  }
  
  async verify(commitments: ReasoningCommitment[]): Promise<VerifiableAnalysis> {
    return await verifyAllReveals(commitments, this.reveals);
  }
}

// ============================================================================
// Integration Example
// ============================================================================

/**
 * Example: Run verifiable multi-agent consensus
 * 
 * ```typescript
 * const commitPhase = new CommitPhase();
 * 
 * // Phase 1: Each agent commits reasoning (independently)
 * for (const agent of agents) {
 *   const reasoning = await agent.analyzeOpportunity(opp);
 *   commitPhase.addCommitment(agent.id, reasoning);
 * }
 * 
 * // Phase 2: After all commits, agents reveal
 * const revealPhase = new RevealPhase();
 * for (const agent of agents) {
 *   const nonce = commitPhase.getNonce(agent.id);
 *   const reasoning = agent.getCachedReasoning(); // Must be same as committed
 *   revealPhase.addReveal(revealReasoning(agent.id, reasoning, nonce));
 * }
 * 
 * // Phase 3: Verify all reveals match commitments
 * const verification = revealPhase.verify(commitPhase.getCommitments());
 * console.log('All verified:', verification.allVerified);
 * console.log('Trust score:', verification.trustScore);
 * ```
 */
