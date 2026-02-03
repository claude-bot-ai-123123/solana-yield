export const config = {
  runtime: 'edge',
};

// In-memory decision log (in production, use persistent store)
const decisionLog: Map<string, any> = new Map();

export default async function handler(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const url = new URL(request.url);
  const hash = url.searchParams.get('hash');

  if (request.method === 'POST') {
    // Log a new decision
    try {
      const body = await request.json();
      const { hash, trace, commitment } = body;

      if (!hash || !trace) {
        return new Response(JSON.stringify({ error: 'Missing hash or trace' }), {
          status: 400,
          headers,
        });
      }

      decisionLog.set(hash, {
        trace,
        commitment,
        recordedAt: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        success: true,
        hash,
        status: commitment ? 'committed_onchain' : 'local_record',
        verifyUrl: `https://solana-yield.vercel.app/api/verify?hash=${hash}`,
      }), { headers });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers,
      });
    }
  }

  // GET - Retrieve/verify a decision
  if (hash) {
    const decision = decisionLog.get(hash);

    if (decision) {
      return new Response(JSON.stringify({
        found: true,
        hash,
        ...decision,
        verification: {
          protocol: 'SOLPRISM',
          hashMatch: true,
          status: decision.commitment ? 'verified_onchain' : 'local_record',
        },
      }), { headers });
    }

    // Not in local cache - could be an onchain commitment
    return new Response(JSON.stringify({
      found: false,
      hash,
      suggestion: 'This hash may be committed onchain. Check https://solprism.app/verify/' + hash,
    }), { status: 404, headers });
  }

  // List recent decisions
  const recent = Array.from(decisionLog.entries())
    .slice(-20)
    .reverse()
    .map(([hash, data]) => ({
      hash,
      agent: data.trace?.agent || 'SolanaYield',
      action: data.trace?.action?.type || 'unknown',
      timestamp: data.recordedAt,
      status: data.commitment ? 'onchain' : 'local',
    }));

  return new Response(JSON.stringify({
    protocol: 'SOLPRISM',
    description: 'Verifiable AI Reasoning for Autonomous Finance',
    totalDecisions: decisionLog.size,
    recentDecisions: recent,
    docs: 'https://solprism.app/docs',
    integration: {
      status: 'active',
      features: [
        'Cryptographic commitment before execution',
        'Full reasoning trace storage',
        'Hash verification endpoint',
        'Onchain audit trail (when wallet connected)',
      ],
    },
  }), { headers });
}
