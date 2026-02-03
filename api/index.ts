export const config = {
  runtime: 'edge',
};

export default function handler(request: Request) {
  return new Response(JSON.stringify({
    name: 'SolanaYield API',
    version: '0.4.0',
    description: 'Autonomous DeFi yield orchestrator with transparent reasoning — every decision explained',
    tagline: 'No black boxes. No hidden logic. Complete transparency.',
    highlight: '🧠 NEW: Transparent Reasoning Engine — see exactly WHY every decision is made',
    endpoints: {
      '⭐_transparency': {
        '/api/explain': '🧠 Interactive reasoning explanation (visual UI)',
        '/api/reasoning': 'GET - Complete reasoning chain JSON (?mode=simple|full)',
        '/api/reasoning?whatif=high': 'GET - "What if I chose high risk?" counterfactual',
        '/api/confidence': '🎯 Confidence scoring system (0-100 with factor breakdown)',
        '/api/confidence?format=json': 'GET - Raw confidence scores JSON',
        '/api/whatif/demo': '🔮 NEW: What-If Simulator - explore alternate realities',
        '/api/whatif/scenarios': 'GET - List available what-if scenarios',
        '/api/whatif/quick?risk=high': 'GET - Quick what-if risk comparison',
      },
      core: {
        '/api/yields': 'GET - Yield opportunities from Kamino, Drift, Jito, Marinade',
        '/api/quote': 'GET - Swap quote (?from=SOL&to=USDC&amount=1)',
        '/api/risk': 'GET - Risk-adjusted yield analysis',
      },
      trust_layer: {
        '/api/trust-score': 'GET - Protocol trust ratings (Moody\'s for DeFi)',
        '/api/rugpull': 'GET - 🛡️ Real-time rug pull detection',
        '/api/alerts': 'GET - 🚨 Live rug pull alert dashboard',
      },
      ui_dashboards: {
        '/api/explain': '🧠 Decision Transparency Engine',
        '/api/live': 'GET - Live decision stream UI',
        '/api/alerts': 'GET - Rug pull detection dashboard',
        '/api/autopilot': 'GET - Autonomous decision analysis',
        '/replay.html': '🔮 What-If Simulator UI - interactive scenario explorer',
      },
      audit_trail: {
        '/api/audit/decisions': 'GET - Query decision history',
        '/api/audit/stats': 'GET - Decision statistics',
        '/api/audit/timeline': 'GET - Decision timeline',
        '/api/audit/export': 'GET - Export for compliance',
      },
      agent_endpoints: {
        '/api/stream': 'GET - SSE stream for real-time thought feed',
        '/api/portfolio': 'GET - Portfolio analysis with recommendations',
        '/api/strategy': 'GET - Strategy recommendations by risk profile',
        '/api/webhook': 'POST - Register for decision webhooks',
      },
    },
    features: {
      '⭐_transparent_reasoning': [
        '🔍 Step-by-step decision chain with evidence',
        '📊 Risk factor breakdown with weights',
        '🔀 Alternatives considered & why rejected',
        '🔮 What-If Simulator: "What if I chose aggressive?" - full counterfactual analysis',
        '🧒 ELI5 explanations for non-technical users',
        '📋 Full audit trail for compliance',
      ],
      '🔮_whatif_simulator': [
        '🚀 Simulate aggressive risk strategies',
        '🛡️ Compare conservative vs actual decisions',
        '💰 Yield hunter mode (lower rebalance threshold)',
        '🎯 Concentrated vs diversified portfolios',
        '📊 Side-by-side original vs simulated comparison',
        '💡 Cross-scenario learnings & recommendations',
      ],
      '🎯_confidence_scoring': [
        '📈 0-100 confidence score for every analysis',
        '🔢 6 confidence factors: Data Freshness, Completeness, Source Agreement, Protocol Knowledge, Market Stability, Historical Accuracy',
        '⚖️ Risk × Confidence matrix: "How risky?" vs "How sure are we?"',
        '💡 Actionable recommendations to improve confidence',
        '🏷️ Letter grades (A+ to F) for quick assessment',
        '🔍 Full factor breakdown with explanations',
      ],
      yield_optimization: [
        'Real-time yields from 9+ Solana DeFi protocols',
        'Risk-adjusted APY scoring (Sharpe ratio for DeFi)',
        'Portfolio rebalancing recommendations',
      ],
      rug_detection: [
        '📉 TVL collapse / liquidity drain detection',
        '🐋 Whale concentration & dump monitoring',
        '🔐 Contract upgrade authority analysis',
        '⚡ Real-time alert generation',
      ],
      trust_scoring: [
        'Moody\'s-style letter grades (AAA to D)',
        'Multi-factor analysis (audits, TVL, team, history)',
        'Transparent factor breakdown',
      ],
    },
    philosophy: {
      core_belief: 'AI agents managing money MUST be transparent',
      approach: 'Every decision comes with complete reasoning chain',
      goal: 'Build trust through radical transparency, not obscurity',
    },
    github: 'https://github.com/claude-bot-ai-123123/solana-yield',
    hackathon: 'Colosseum Agent Hackathon Feb 2-12, 2026',
    builder: 'jeeves (AI agent)',
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
