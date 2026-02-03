/**
 * Verifiable Reasoning API
 * 
 * Demonstrates cryptographic commit-reveal proof for AI agent analysis.
 * Returns yields analysis with SOLPRISM-inspired verification data.
 */

export const config = {
  runtime: 'edge',
};

import { analyzeYieldsVerifiable } from '../src/lib/consensus';
import { YieldOpportunity } from '../src/types';

export default async function handler(request: Request) {
  const headers = { 
    'Content-Type': 'application/json', 
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
  };

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '5');
  const agentId = url.searchParams.get('agentId') || 'yield-analyst';

  try {
    // Fetch yields from DeFi Llama
    const response = await fetch('https://yields.llama.fi/pools');
    const data = await response.json();
    
    // Filter Solana opportunities
    const opportunities: YieldOpportunity[] = data.data
      .filter((p: any) => 
        p.chain === 'Solana' && 
        p.tvlUsd > 100000 && 
        p.apy > 0 &&
        p.apy < 100 // Filter unrealistic APYs
      )
      .slice(0, limit * 2) // Get more to analyze
      .map((p: any) => ({
        protocol: p.project,
        asset: p.symbol,
        apy: p.apy,
        tvl: p.tvlUsd,
        chain: 'solana' as const,
        risk: {
          level: p.stablecoin ? 'low' as const : p.apy > 20 ? 'high' as const : 'medium' as const,
          factors: []
        }
      }));

    if (opportunities.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No Solana opportunities found' 
      }), { status: 404, headers });
    }

    // Run verifiable analysis with commit-reveal proof
    const analysis = await analyzeYieldsVerifiable(opportunities, agentId);

    // Extract verification metadata
    const verificationMeta = analysis.verification ? {
      allVerified: analysis.verification.allVerified,
      trustScore: analysis.verification.trustScore,
      commitments: analysis.verification.commitments.length,
      reveals: analysis.verification.reveals.length,
      commitHashes: analysis.verification.commitments.map(c => ({
        agentId: c.agentId,
        hash: c.commitHash,
        timestamp: c.timestamp
      })),
      verificationResults: analysis.verification.verifications.map(v => ({
        agentId: v.agentId,
        verified: v.verified,
        commitHash: v.commitHash.slice(0, 16) + '...',
        revealedHash: v.revealedHash.slice(0, 16) + '...',
        error: v.error
      }))
    } : null;

    // Format response
    const topAnalyses = analysis.analyses.slice(0, limit);
    
    return new Response(JSON.stringify({
      meta: {
        timestamp: analysis.timestamp,
        agentId,
        opportunitiesAnalyzed: analysis.opportunities.length,
        topRecommendations: topAnalyses.length,
        verifiable: true,
        verification: verificationMeta
      },
      recommendations: topAnalyses.map(a => ({
        protocol: a.opportunity.protocol,
        asset: a.opportunity.asset,
        apy: a.opportunity.apy,
        tvl: a.opportunity.tvl,
        score: Math.round(a.overallScore),
        decision: a.decision,
        confidence: Math.round(a.confidence * 100),
        reasoning: a.reasoning,
        verification: a.verification ? {
          verified: a.verification.verified,
          commitHash: a.verification.commitment.commitHash.slice(0, 16) + '...',
          timestamp: a.verification.commitment.timestamp
        } : null,
        factors: a.factors.map(f => ({
          name: f.name,
          score: Math.round(f.score),
          impact: f.impact,
          reasoning: f.reasoning
        }))
      })),
      thoughtStream: analysis.thoughtStream.slice(-20), // Last 20 thoughts
      summary: analysis.summary,
      disclaimer: 'Verifiable reasoning powered by commit-reveal cryptographic proof. This is not financial advice.'
    }), { headers });

  } catch (err) {
    console.error('Verifiable analysis error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to run verifiable analysis',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), { status: 500, headers });
  }
}
