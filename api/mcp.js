/**
 * MCP (Model Context Protocol) Endpoints
 * Standalone serverless function for AI agent integration
 */

module.exports = async (req, res) => {
  const { method, url } = req;
  const path = (url || '/').split('?')[0].replace(/^\/api\/mcp/, '');

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (`${method} ${path}`) {
      case 'GET /':
      case 'GET':
        return res.status(200).json({
          name: 'SolanaYield MCP Server',
          description: 'Model Context Protocol integration for AI agents',
          spec: 'https://spec.modelcontextprotocol.io/',
          status: 'operational',
          endpoints: {
            '/api/mcp/info': 'Server capabilities',
            '/api/mcp/tools/list': 'List available tools',
            '/api/mcp/tools/call': 'Execute a tool [POST]',
          },
          docs: 'https://github.com/claude-bot-ai-123123/solana-yield/blob/main/docs/MCP_INTEGRATION.md',
        });

      case 'GET /info':
        return res.status(200).json({
          name: 'SolanaYield',
          version: '0.3.0',
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
            experimental: {
              streaming: true,
            },
          },
        });

      case 'GET /tools/list':
        return res.status(200).json({
          tools: [
            {
              name: 'get_yield_recommendations',
              description: 'Get risk-adjusted yield recommendations for Solana DeFi protocols',
              inputSchema: {
                type: 'object',
                properties: {
                  riskTolerance: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Risk tolerance level',
                  },
                  topN: {
                    type: 'number',
                    description: 'Number of recommendations',
                    default: 10,
                  },
                },
                required: ['riskTolerance'],
              },
            },
            {
              name: 'analyze_protocol_risk',
              description: 'Get detailed risk analysis for a specific DeFi protocol',
              inputSchema: {
                type: 'object',
                properties: {
                  protocol: {
                    type: 'string',
                    description: 'Protocol name (e.g., "Kamino", "Drift")',
                  },
                },
                required: ['protocol'],
              },
            },
            {
              name: 'get_market_snapshot',
              description: 'Get current snapshot of all Solana yield opportunities',
              inputSchema: {
                type: 'object',
                properties: {
                  includeRiskScores: {
                    type: 'boolean',
                    description: 'Include risk analysis',
                    default: true,
                  },
                },
              },
            },
          ],
        });

      case 'POST /tools/call':
        let body = '';
        await new Promise((resolve) => {
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => resolve());
        });

        const request = JSON.parse(body);
        const { name, arguments: args = {} } = request;

        // Delegate to main API
        const apiUrl = `https://solana-yield.vercel.app/risk/analyze?risk=${args.riskTolerance || 'medium'}&top=${args.topN || 10}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        return res.status(200).json({
          result: data,
        });

      default:
        return res.status(404).json({ error: 'MCP endpoint not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
