export const config = {
  runtime: 'edge',
};

export default function handler(request: Request) {
  return new Response(JSON.stringify({
    name: 'SolanaYield API',
    version: '0.2.0',
    description: 'Autonomous DeFi yield orchestrator for AI agents — with real-time rug pull detection',
    tagline: 'Trust, but verify — automatically.',
    endpoints: {
      core: {
        '/api/yields': 'GET - Yield opportunities from Kamino, Drift, Jito, Marinade',
        '/api/quote': 'GET - Swap quote (?from=SOL&to=USDC&amount=1)',
        '/api/risk': 'GET - Risk-adjusted yield analysis',
      },
      trust_layer: {
        '/api/trust-score': 'GET - Protocol trust ratings (Moody\'s for DeFi). ?protocol=kamino or ?all=true',
        '/api/rugpull': 'GET - 🛡️ Real-time rug pull detection. ?protocol=kamino or ?all=true or ?alerts=true',
        '/api/alerts': 'GET - 🚨 Live rug pull alert dashboard (cyberpunk UI)',
      },
      ui_dashboards: {
        '/api/live': 'GET - Live decision stream UI',
        '/api/alerts': 'GET - Rug pull detection dashboard',
        '/api/autopilot': 'GET - Autonomous decision analysis',
      },
      agent_endpoints: {
        '/api/stream': 'GET - SSE stream for real-time thought feed',
        '/api/portfolio': 'GET - Portfolio analysis with recommendations',
        '/api/strategy': 'GET - Strategy recommendations based on risk profile',
      },
    },
    features: {
      yield_optimization: [
        'Real-time yields from 9+ Solana DeFi protocols',
        'Risk-adjusted APY scoring (Sharpe ratio for DeFi)',
        'Portfolio rebalancing recommendations',
      ],
      rug_detection: [
        '📉 TVL collapse / liquidity drain detection',
        '🐋 Whale concentration & dump monitoring',
        '🔐 Contract upgrade authority analysis',
        '🖨️ Mint/freeze authority detection',
        '🔓 Token unlock schedule tracking',
        '⚡ Real-time alert generation',
      ],
      trust_scoring: [
        'Moody\'s-style letter grades (AAA to D)',
        'Multi-factor analysis (audits, TVL, team, history)',
        'Transparent factor breakdown',
      ],
    },
    github: 'https://github.com/claude-bot-ai-123123/solana-yield',
    hackathon: 'Colosseum Agent Hackathon Feb 2-12, 2026',
    builder: 'jeeves (AI agent)',
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
