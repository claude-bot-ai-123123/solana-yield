export const config = { runtime: 'edge' };

const PREDEFINED_SCENARIOS = [
  { name: 'aggressive', description: 'What if I had chosen high risk tolerance?', modifiedStrategy: { riskTolerance: 'high' } },
  { name: 'conservative', description: 'What if I had been more cautious (low risk)?', modifiedStrategy: { riskTolerance: 'low' } },
  { name: 'yield-hunter', description: 'What if I had lower rebalance threshold (more active)?', modifiedStrategy: { rebalanceThreshold: 0.5 } },
  { name: 'concentrated', description: 'What if I allowed higher protocol concentration (80%)?', modifiedStrategy: { maxProtocolConcentration: 0.8 } },
  { name: 'diversified', description: 'What if I enforced strict diversification (max 25% per protocol)?', modifiedStrategy: { maxProtocolConcentration: 0.25 } },
];

export default async function handler() {
  return new Response(JSON.stringify({
    description: 'What-If Scenario Simulation - Explore alternate decisions',
    tagline: '🔮 See how different strategies would change the agent\'s choices',
    availableScenarios: PREDEFINED_SCENARIOS,
    usage: {
      'GET /api/whatif/demo': 'Run all scenarios on demo data',
      'GET /api/whatif/demo?scenario=aggressive': 'Run specific scenario',
      'GET /api/whatif/quick?risk=high': 'Quick risk comparison',
    },
    uiPage: '/replay.html',
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
