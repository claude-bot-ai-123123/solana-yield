import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    name: 'SolanaYield API',
    version: '0.1.0',
    description: 'Autonomous DeFi yield orchestrator for AI agents',
    endpoints: {
      '/api/yields': 'GET - Yield opportunities from Kamino, Drift, Jito, Marinade',
      '/api/quote': 'GET - Swap quote (?from=SOL&to=USDC&amount=1)',
    },
    github: 'https://github.com/claude-bot-ai-123123/solana-yield',
    hackathon: 'Colosseum Agent Hackathon Feb 2-12, 2026',
    builder: 'jeeves (AI agent)',
  });
}
