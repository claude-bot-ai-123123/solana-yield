/**
 * Vercel Serverless Function Entry Point
 * Routes all requests to the main HTTP server
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Connection } from '@solana/web3.js';
import { YieldMonitor } from '../dist/index.mjs';
import { JupiterSwap, TOKENS } from '../dist/index.mjs';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn, 
  getTopRecommendations,
  PROTOCOL_PROFILES,
} from '../dist/index.mjs';
import { getHistoryStore } from '../dist/index.mjs';
import { MCPServer } from '../dist/index.mjs';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const monitor = new YieldMonitor(connection);
const jupiter = new JupiterSwap(connection);
const historyStore = getHistoryStore(process.env.DECISION_DATA_DIR || '/tmp/decisions');
const mcpServer = new MCPServer(connection);

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void>;
}

const routes: Record<string, RouteHandler> = {
  'GET /': async (req, res) => {
    json(res, {
      name: 'SolanaYield API',
      version: '0.3.0',
      description: 'Autonomous DeFi yield orchestrator with MCP integration',
      endpoints: {
        '/yields': 'GET - All yield opportunities',
        '/yields/top': 'GET - Top 10 by raw APY',
        '/risk/analyze': 'GET - Risk-adjusted recommendations',
        '/mcp': 'MCP endpoints (AI agent integration)',
        '/mcp/info': 'GET - MCP server capabilities',
        '/mcp/tools/list': 'GET - List available tools',
        '/mcp/tools/call': 'POST - Call a tool',
      },
    });
  },

  'GET /health': async (req, res) => {
    json(res, { status: 'ok', timestamp: new Date().toISOString() });
  },

  'GET /yields': async (req, res) => {
    try {
      const yields = await monitor.fetchAllYields();
      json(res, { count: yields.length, yields });
    } catch (err) {
      error(res, 500, `Failed to fetch yields: ${err}`);
    }
  },

  'GET /yields/top': async (req, res) => {
    try {
      const yields = await monitor.fetchAllYields();
      json(res, { yields: yields.slice(0, 10) });
    } catch (err) {
      error(res, 500, `Failed to fetch yields: ${err}`);
    }
  },

  'GET /risk/analyze': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost`);
    const riskLevel = url.searchParams.get('risk') || 'medium';
    const topN = parseInt(url.searchParams.get('top') || '10');
    const maxRisk = riskLevel === 'low' ? 35 : riskLevel === 'high' ? 75 : 55;

    try {
      const yields = await monitor.fetchAllSolanaOpportunities();
      const recommendations = getTopRecommendations(yields, topN, maxRisk);

      json(res, {
        strategy: { riskTolerance: riskLevel, maxRiskScore: maxRisk },
        count: recommendations.length,
        recommendations: recommendations.map(r => ({
          protocol: r.protocol,
          asset: r.asset,
          rawApy: parseFloat(r.apy.toFixed(2)),
          riskAdjustedApy: parseFloat(r.adjustedApy.toFixed(2)),
          riskScore: r.riskScore.overall,
          sharpeRatio: parseFloat(r.sharpeRatio.toFixed(2)),
        })),
      });
    } catch (err) {
      error(res, 500, `Risk analysis failed: ${err}`);
    }
  },

  'GET /mcp': async (req, res) => {
    json(res, {
      name: 'SolanaYield MCP Server',
      description: 'Model Context Protocol - AI agent integration',
      spec: 'https://spec.modelcontextprotocol.io/',
      capabilities: mcpServer.getServerInfo().capabilities,
      endpoints: {
        '/mcp/info': 'Server info',
        '/mcp/tools/list': 'List tools',
        '/mcp/tools/call': 'Call tool [POST]',
      },
    });
  },

  'GET /mcp/info': async (req, res) => {
    json(res, mcpServer.getServerInfo());
  },

  'GET /mcp/tools/list': async (req, res) => {
    json(res, { tools: mcpServer.listTools() });
  },

  'POST /mcp/tools/call': async (req, res) => {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const result = await mcpServer.callTool(request.name, request.arguments || {});
          json(res, { result });
        } catch (err) {
          error(res, 400, `Tool call failed: ${err}`);
        }
      });
    } catch (err) {
      error(res, 500, `Request failed: ${err}`);
    }
  },

  'GET /mcp/resources/list': async (req, res) => {
    json(res, { resources: mcpServer.listResources() });
  },

  'GET /mcp/prompts/list': async (req, res) => {
    json(res, { prompts: mcpServer.listPrompts() });
  },
};

function json(res: ServerResponse, data: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data, null, 2));
}

function error(res: ServerResponse, code: number, message: string) {
  res.statusCode = code;
  json(res, { error: message });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = req.method || 'GET';
  const path = req.url || '/';
  const routeKey = `${method} ${path.split('?')[0]}`;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  const handler = routes[routeKey];
  if (handler) {
    try {
      // Create mock HTTP objects for compatibility
      const mockReq = req as any as IncomingMessage;
      const mockRes = res as any as ServerResponse;
      await handler(mockReq, mockRes);
    } catch (err) {
      res.status(500).json({ error: `Internal error: ${err}` });
    }
  } else {
    // Default to root handler
    try {
      const mockReq = req as any as IncomingMessage;
      const mockRes = res as any as ServerResponse;
      await routes['GET /'](mockReq, mockRes);
    } catch (err) {
      res.status(404).json({ error: 'Not found' });
    }
  }
}
