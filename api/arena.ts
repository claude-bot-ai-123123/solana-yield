import type { VercelRequest, VercelResponse } from '@vercel/node';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

interface AgentPersona {
  name: string;
  role: string;
  strategy: string;
  color: string;
}

const AGENTS: AgentPersona[] = [
  {
    name: 'Atlas',
    role: 'Conservative Yield Optimizer',
    strategy: 'Focus on stable, low-risk yields with established protocols. Prioritize capital preservation.',
    color: '#3b82f6'
  },
  {
    name: 'Nova',
    role: 'Aggressive Growth Hunter',
    strategy: 'Target high-APY opportunities. Accept higher risk for exponential returns. Early adopter mindset.',
    color: '#8b5cf6'
  },
  {
    name: 'Sage',
    role: 'Risk-Adjusted Strategist',
    strategy: 'Balance risk and reward. Diversify across protocols. Focus on Sharpe ratio optimization.',
    color: '#10b981'
  }
];

interface DebateMessage {
  agent: string;
  message: string;
  timestamp: number;
}

async function callClaude(prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { scenario, yields } = req.body;

  if (!scenario || !yields) {
    return res.status(400).json({ error: 'Missing scenario or yields data' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    // Format yields for debate context
    const yieldsContext = yields.map((y: any) => 
      `- ${y.protocol}: ${y.apy.toFixed(2)}% APY, TVL: $${(y.tvl / 1e6).toFixed(1)}M, Risk: ${y.risk}/10`
    ).join('\n');

    const debateHistory: DebateMessage[] = [];

    // Round 1: Initial positions
    console.log('Round 1: Initial positions');
    for (const agent of AGENTS) {
      const systemPrompt = `You are ${agent.name}, a DeFi strategy agent. ${agent.strategy}

Your personality:
- ${agent.name === 'Atlas' ? 'Cautious, analytical, focused on downside protection' : ''}
- ${agent.name === 'Nova' ? 'Bold, opportunistic, focused on alpha generation' : ''}
- ${agent.name === 'Sage' ? 'Balanced, methodical, focused on risk-adjusted returns' : ''}

Keep responses to 2-3 sentences. Be decisive and opinionated.`;

      const prompt = `Given this scenario: "${scenario}"

Available yields:
${yieldsContext}

State your recommended strategy and why it's superior. Be specific about which protocols to use and allocation percentages.`;

      const response = await callClaude(prompt, systemPrompt);
      
      debateHistory.push({
        agent: agent.name,
        message: response,
        timestamp: Date.now()
      });
    }

    // Round 2: Rebuttals
    console.log('Round 2: Rebuttals');
    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const opponent = AGENTS[(i + 1) % AGENTS.length];
      const opponentMessage = debateHistory.find(m => m.agent === opponent.name)?.message || '';

      const systemPrompt = `You are ${agent.name}, a DeFi strategy agent. ${agent.strategy}

Keep responses to 2-3 sentences. Challenge your opponent's logic with specific facts.`;

      const prompt = `${opponent.name} said: "${opponentMessage}"

Counter their argument. Point out specific flaws in their strategy or explain why your approach is better given the current market data:

${yieldsContext}

Be assertive but factual.`;

      const response = await callClaude(prompt, systemPrompt);
      
      debateHistory.push({
        agent: agent.name,
        message: response,
        timestamp: Date.now()
      });
    }

    // Round 3: Consensus attempt
    console.log('Round 3: Consensus');
    const consensusPrompt = `Three AI agents (Atlas, Nova, Sage) debated DeFi strategies for this scenario: "${scenario}"

Available yields:
${yieldsContext}

Their positions:
${debateHistory.slice(0, 3).map(m => `${m.agent}: ${m.message}`).join('\n\n')}

Their rebuttals:
${debateHistory.slice(3).map(m => `${m.agent}: ${m.message}`).join('\n\n')}

Synthesize their debate into a final consensus recommendation. Include:
1. Primary allocation (which protocol(s) and %)
2. Key risk considerations from the debate
3. Expected outcome

Keep it to 3-4 sentences.`;

    const consensus = await callClaude(
      consensusPrompt,
      'You are an impartial arbitrator synthesizing multiple agent perspectives into actionable strategy.'
    );

    debateHistory.push({
      agent: 'Consensus',
      message: consensus,
      timestamp: Date.now()
    });

    return res.status(200).json({
      agents: AGENTS,
      debate: debateHistory,
      scenario,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('Arena error:', error);
    return res.status(500).json({ 
      error: 'Failed to run arena debate',
      details: error.message 
    });
  }
}
