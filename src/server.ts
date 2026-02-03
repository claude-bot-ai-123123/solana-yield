/**
 * SolanaYield HTTP API Server
 * Simple REST API for yield monitoring and quotes
 * Now with risk-adjusted recommendations and full audit trail!
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Connection } from '@solana/web3.js';
import { YieldMonitor } from './lib/monitor';
import { JupiterSwap, TOKENS } from './lib/jupiter';
import { 
  analyzeOpportunities, 
  sortByRiskAdjustedReturn, 
  getTopRecommendations,
  calculateRiskScore,
  PROTOCOL_PROFILES,
} from './lib/risk';
import { 
  getHistoryStore, 
  DecisionQuery,
  DecisionRecord,
} from './lib/history';
import { MCPServer } from './lib/mcp';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const monitor = new YieldMonitor(connection);
const jupiter = new JupiterSwap(connection);
const historyStore = getHistoryStore(process.env.DECISION_DATA_DIR || './data/decisions');
const mcpServer = new MCPServer(connection);

const PORT = process.env.PORT || 3000;

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void>;
}

const routes: Record<string, RouteHandler> = {
  'GET /': async (req, res) => {
    json(res, {
      name: 'SolanaYield API',
      version: '0.3.0',
      description: 'Autonomous DeFi yield orchestrator with risk-adjusted recommendations and full audit trail',
      endpoints: {
        '/yields': 'GET - All yield opportunities (raw APY)',
        '/yields/top': 'GET - Top 10 by raw APY',
        '/yields/all': 'GET - All Solana yields',
        '/risk/analyze': 'GET - Risk-adjusted recommendations (?risk=medium&top=10)',
        '/risk/compare': 'GET - Compare raw APY vs risk-adjusted rankings',
        '/risk/protocols': 'GET - Protocol risk profiles',
        '/quote': 'GET - Swap quote (?from=SOL&to=USDC&amount=1)',
        '/audit/decisions': 'GET - Query decision history (?type=rebalance&limit=20)',
        '/audit/stats': 'GET - Decision statistics summary',
        '/audit/timeline': 'GET - Decision timeline (?groupBy=hour|day)',
        '/audit/export': 'GET - Export decisions for compliance (?startDate=2024-01-01)',
        '/health': 'GET - Health check',
        '/mcp': 'MCP (Model Context Protocol) - AI agent integration',
        '/mcp/info': 'GET - MCP server capabilities',
        '/mcp/tools/list': 'GET - List available tools',
        '/mcp/tools/call': 'POST - Call a tool',
        '/mcp/resources/list': 'GET - List available resources',
        '/mcp/prompts/list': 'GET - List available prompts',
        '/mcp/stream': 'GET - SSE stream for real-time updates',
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

  'GET /yields/all': async (req, res) => {
    try {
      const yields = await monitor.fetchAllSolanaOpportunities();
      json(res, { count: yields.length, yields: yields.slice(0, 50) });
    } catch (err) {
      error(res, 500, `Failed to fetch yields: ${err}`);
    }
  },

  'GET /quote': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const from = url.searchParams.get('from')?.toUpperCase() || 'SOL';
    const to = url.searchParams.get('to')?.toUpperCase() || 'USDC';
    const amount = parseFloat(url.searchParams.get('amount') || '1');

    const fromMint = (TOKENS as Record<string, string>)[from];
    const toMint = (TOKENS as Record<string, string>)[to];

    if (!fromMint || !toMint) {
      error(res, 400, `Unknown token. Supported: ${Object.keys(TOKENS).join(', ')}`);
      return;
    }

    try {
      // Convert to smallest unit (assuming 9 decimals for SOL-like, 6 for USDC)
      const decimals = from === 'USDC' || from === 'USDT' ? 6 : 9;
      const amountBase = Math.floor(amount * Math.pow(10, decimals));
      
      const route = await jupiter.getBestRoute(fromMint, toMint, amountBase);
      const outputDecimals = to === 'USDC' || to === 'USDT' ? 6 : 9;
      
      json(res, {
        from,
        to,
        inputAmount: amount,
        outputAmount: route.expectedOutput / Math.pow(10, outputDecimals),
        priceImpact: route.priceImpact,
        route: route.route,
      });
    } catch (err) {
      error(res, 500, `Quote failed: ${err}`);
    }
  },

  // ============================================================================
  // Risk-Adjusted Endpoints (NEW!)
  // ============================================================================

  'GET /risk/analyze': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const riskLevel = url.searchParams.get('risk') || 'medium';
    const topN = parseInt(url.searchParams.get('top') || '10');

    const maxRisk = riskLevel === 'low' ? 35 : riskLevel === 'high' ? 75 : 55;

    try {
      const yields = await monitor.fetchAllSolanaOpportunities();
      const recommendations = getTopRecommendations(yields, topN, maxRisk);

      json(res, {
        strategy: {
          riskTolerance: riskLevel,
          maxRiskScore: maxRisk,
          description: 'Recommendations sorted by risk-adjusted APY (not raw APY)',
        },
        count: recommendations.length,
        recommendations: recommendations.map(r => ({
          protocol: r.protocol,
          asset: r.asset,
          recommendation: r.recommendation,
          rawApy: parseFloat(r.apy.toFixed(2)),
          riskAdjustedApy: parseFloat(r.adjustedApy.toFixed(2)),
          riskScore: r.riskScore.overall,
          sharpeRatio: parseFloat(r.sharpeRatio.toFixed(2)),
          tvl: r.tvl,
          riskFactors: r.riskScore.factors,
          warnings: r.riskScore.warnings,
          positives: r.riskScore.positives,
          reasoning: r.reasoning,
        })),
      });
    } catch (err) {
      error(res, 500, `Risk analysis failed: ${err}`);
    }
  },

  'GET /risk/compare': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const topN = parseInt(url.searchParams.get('top') || '5');

    try {
      const yields = await monitor.fetchAllSolanaOpportunities();
      const analyzed = analyzeOpportunities(yields);

      // Sort by raw APY (naive approach)
      const byRawApy = [...analyzed]
        .sort((a, b) => b.apy - a.apy)
        .slice(0, topN)
        .map(o => ({
          protocol: o.protocol,
          asset: o.asset,
          rawApy: parseFloat(o.apy.toFixed(2)),
          riskScore: o.riskScore.overall,
          warnings: o.riskScore.warnings,
        }));

      // Sort by risk-adjusted APY (smart approach)
      const byAdjusted = sortByRiskAdjustedReturn(analyzed)
        .slice(0, topN)
        .map(o => ({
          protocol: o.protocol,
          asset: o.asset,
          rawApy: parseFloat(o.apy.toFixed(2)),
          riskAdjustedApy: parseFloat(o.adjustedApy.toFixed(2)),
          sharpeRatio: parseFloat(o.sharpeRatio.toFixed(2)),
          riskScore: o.riskScore.overall,
          positives: o.riskScore.positives,
        }));

      json(res, {
        description: 'Compare naive (raw APY) vs smart (risk-adjusted) ranking',
        naive_ranking: {
          strategy: 'Sort by highest raw APY',
          results: byRawApy,
          warning: 'This approach ignores protocol risk, TVL, and APY sustainability',
        },
        smart_ranking: {
          strategy: 'Sort by risk-adjusted APY (like Sharpe ratio for DeFi)',
          results: byAdjusted,
          explanation: 'Penalizes APY based on smart contract risk, TVL, sustainability, and asset volatility',
        },
      });
    } catch (err) {
      error(res, 500, `Comparison failed: ${err}`);
    }
  },

  'GET /risk/protocols': async (req, res) => {
    json(res, {
      description: 'Protocol risk profiles used for scoring',
      profiles: PROTOCOL_PROFILES,
      scoring: {
        smartContract: 'Based on audit status, historical incidents, protocol age',
        liquidity: 'Based on TVL depth',
        sustainability: 'Based on APY level and reward dependency',
        counterparty: 'Based on centralization and insurance coverage',
        assetVolatility: 'Based on asset type (stablecoin vs volatile)',
      },
      weights: {
        smartContract: 0.30,
        liquidity: 0.20,
        sustainability: 0.20,
        counterparty: 0.15,
        assetVolatility: 0.15,
      },
    });
  },

  // ============================================================================
  // Audit Trail Endpoints - Full Decision Transparency
  // ============================================================================

  'GET /audit/decisions': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    
    const query: DecisionQuery = {
      limit: parseInt(url.searchParams.get('limit') || '20'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    // Type filter (comma-separated)
    const typesParam = url.searchParams.get('type') || url.searchParams.get('types');
    if (typesParam) {
      query.types = typesParam.split(',') as any;
    }

    // Protocol filter
    const protocolsParam = url.searchParams.get('protocol') || url.searchParams.get('protocols');
    if (protocolsParam) {
      query.protocols = protocolsParam.split(',');
    }

    // Asset filter
    const assetsParam = url.searchParams.get('asset') || url.searchParams.get('assets');
    if (assetsParam) {
      query.assets = assetsParam.split(',');
    }

    // Time range
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    if (startTime) query.startTime = parseInt(startTime);
    if (endTime) query.endTime = parseInt(endTime);

    // Date shortcuts
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    if (startDate) query.startTime = new Date(startDate).getTime();
    if (endDate) query.endTime = new Date(endDate + 'T23:59:59').getTime();

    // Confidence filter
    const minConf = url.searchParams.get('minConfidence');
    if (minConf) query.minConfidence = parseFloat(minConf);

    // Execution filter
    if (url.searchParams.get('executedOnly') === 'true') query.executedOnly = true;
    if (url.searchParams.get('withErrors') === 'true') query.withErrors = true;

    try {
      const decisions = await historyStore.query(query);
      
      json(res, {
        query,
        count: decisions.length,
        decisions: decisions.map(d => ({
          id: d.id,
          timestamp: d.decision.timestamp,
          time: new Date(d.decision.timestamp).toISOString(),
          type: d.decision.type,
          confidence: Math.round(d.decision.confidence * 100),
          executed: d.decision.executed,
          hasError: !!d.decision.error,
          protocols: d.meta.protocols,
          assets: d.meta.assets,
          riskChange: d.meta.riskChange,
          apyImpact: d.meta.apyImpact,
          reasoningPreview: d.decision.reasoning.split('\n')[0],
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          hasMore: decisions.length === query.limit,
        },
      });
    } catch (err) {
      error(res, 500, `Failed to query decisions: ${err}`);
    }
  },

  'GET /audit/stats': async (req, res) => {
    try {
      const stats = historyStore.getStats();
      
      json(res, {
        summary: {
          totalDecisions: stats.totalDecisions,
          executionRate: `${(stats.executionRate * 100).toFixed(1)}%`,
          avgConfidence: `${(stats.avgConfidence * 100).toFixed(1)}%`,
          errorRate: `${(stats.errorRate * 100).toFixed(1)}%`,
          totalApyGained: `${stats.totalApyGained.toFixed(2)}%`,
        },
        byDecisionType: stats.byType,
        byProtocol: stats.byProtocol,
        riskChanges: stats.riskChanges,
        timeRange: stats.timeRange.first ? {
          first: new Date(stats.timeRange.first).toISOString(),
          last: new Date(stats.timeRange.last!).toISOString(),
          daysActive: Math.ceil((stats.timeRange.last! - stats.timeRange.first) / (1000 * 60 * 60 * 24)),
        } : null,
      });
    } catch (err) {
      error(res, 500, `Failed to get stats: ${err}`);
    }
  },

  'GET /audit/timeline': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const groupBy = (url.searchParams.get('groupBy') || 'day') as 'hour' | 'day';
    
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    try {
      const timeline = await historyStore.getTimeline({
        groupBy,
        startTime: startTime ? parseInt(startTime) : startDate ? new Date(startDate).getTime() : undefined,
        endTime: endTime ? parseInt(endTime) : endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined,
      });

      json(res, {
        groupBy,
        bucketCount: timeline.buckets.length,
        timeline: timeline.buckets.map(b => ({
          ...b,
          avgConfidence: Math.round(b.avgConfidence * 100),
        })),
      });
    } catch (err) {
      error(res, 500, `Failed to get timeline: ${err}`);
    }
  },

  'GET /audit/export': async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const format = url.searchParams.get('format') || 'json';

    try {
      const exportData = await historyStore.export({ startDate, endDate });

      if (format === 'csv') {
        // CSV export for spreadsheets
        const csvLines = [
          'id,timestamp,type,confidence,executed,error,protocols,assets,riskChange,apyImpact,reasoning',
        ];
        
        for (const record of exportData.records) {
          const d = record.decision;
          csvLines.push([
            record.id,
            new Date(d.timestamp).toISOString(),
            d.type,
            (d.confidence * 100).toFixed(1),
            d.executed ? 'true' : 'false',
            d.error || '',
            record.meta.protocols.join(';'),
            record.meta.assets.join(';'),
            record.meta.riskChange || '',
            record.meta.apyImpact.toFixed(2),
            `"${d.reasoning.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=solanayield-audit-${new Date().toISOString().split('T')[0]}.csv`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(csvLines.join('\n'));
      } else {
        // JSON export (default)
        res.setHeader('Content-Disposition', `attachment; filename=solanayield-audit-${new Date().toISOString().split('T')[0]}.json`);
        json(res, exportData);
      }
    } catch (err) {
      error(res, 500, `Export failed: ${err}`);
    }
  },

  // ============================================================================
  // MCP (Model Context Protocol) - AI Agent Integration
  // ============================================================================

  'GET /mcp': async (req, res) => {
    json(res, {
      name: 'SolanaYield MCP Server',
      description: 'Model Context Protocol integration - allows other AI agents to query yield recommendations',
      spec: 'https://spec.modelcontextprotocol.io/',
      capabilities: mcpServer.getServerInfo().capabilities,
      endpoints: {
        '/mcp/info': 'Server capabilities and version',
        '/mcp/tools/list': 'List available tools (functions agents can call)',
        '/mcp/tools/call': 'Execute a tool [POST]',
        '/mcp/resources/list': 'List available resources (data agents can access)',
        '/mcp/prompts/list': 'List available prompt templates',
        '/mcp/stream': 'Server-Sent Events for real-time yield updates',
      },
      example: {
        tool_call: {
          method: 'POST',
          url: '/mcp/tools/call',
          body: {
            name: 'get_yield_recommendations',
            arguments: {
              riskTolerance: 'medium',
              topN: 5,
            },
          },
        },
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

  'GET /mcp/stream': async (req, res) => {
    // Delegate to MCP server's SSE handler
    await mcpServer.handleMCPRequest(req, res);
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

// Dynamic route handlers for parameterized paths
const dynamicRoutes: Array<{
  pattern: RegExp;
  method: string;
  handler: (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;
}> = [
  {
    pattern: /^\/audit\/decisions\/([^/]+)$/,
    method: 'GET',
    handler: async (req, res, params) => {
      const id = params.id;
      
      try {
        const record = await historyStore.get(id);
        
        if (!record) {
          error(res, 404, `Decision not found: ${id}`);
          return;
        }

        json(res, {
          id: record.id,
          timestamp: record.decision.timestamp,
          time: new Date(record.decision.timestamp).toISOString(),
          type: record.decision.type,
          confidence: record.decision.confidence,
          executed: record.decision.executed,
          error: record.decision.error,
          txIds: record.decision.txIds,
          reasoning: record.decision.reasoning,
          actions: record.decision.actions,
          riskAnalysis: record.decision.riskAnalysis,
          context: {
            portfolioSnapshot: record.context.portfolioSnapshot,
            strategyConfig: record.context.strategyConfig,
            marketConditions: record.context.marketConditions,
            topYieldsAvailable: record.context.riskAnalyzedYields?.slice(0, 5).map(y => ({
              protocol: y.protocol,
              asset: y.asset,
              rawApy: y.apy,
              adjustedApy: y.adjustedApy,
              riskScore: y.riskScore.overall,
            })),
          },
          meta: record.meta,
        });
      } catch (err) {
        error(res, 500, `Failed to get decision: ${err}`);
      }
    },
  },
  {
    pattern: /^\/audit\/replay\/([^/]+)$/,
    method: 'GET',
    handler: async (req, res, params) => {
      const id = params.id;
      
      try {
        const replay = await historyStore.getReplayContext(id);
        
        if (!replay) {
          error(res, 404, `Decision not found: ${id}`);
          return;
        }

        json(res, {
          decision: {
            id: replay.decision.id,
            timestamp: replay.decision.decision.timestamp,
            time: new Date(replay.decision.decision.timestamp).toISOString(),
            type: replay.decision.decision.type,
            confidence: replay.decision.decision.confidence,
            executed: replay.decision.decision.executed,
            reasoning: replay.decision.decision.reasoning,
            actions: replay.decision.decision.actions,
            riskAnalysis: replay.decision.decision.riskAnalysis,
          },
          fullContext: replay.decision.context,
          previousDecisions: replay.previousDecisions.map(p => ({
            id: p.id,
            timestamp: p.decision.timestamp,
            time: new Date(p.decision.timestamp).toISOString(),
            type: p.decision.type,
            confidence: p.decision.confidence,
            executed: p.decision.executed,
          })),
          summary: replay.summary,
        });
      } catch (err) {
        error(res, 500, `Failed to get replay context: ${err}`);
      }
    },
  },
];

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  const path = (req.url || '/').split('?')[0];
  const routeKey = `${method} ${path}`;

  // Try static routes first
  const handler = routes[routeKey];
  if (handler) {
    try {
      await handler(req, res);
      return;
    } catch (err) {
      error(res, 500, `Internal error: ${err}`);
      return;
    }
  }

  // Try dynamic routes
  for (const route of dynamicRoutes) {
    if (route.method !== method) continue;
    
    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = { id: match[1] };
      try {
        await route.handler(req, res, params);
        return;
      } catch (err) {
        error(res, 500, `Internal error: ${err}`);
        return;
      }
    }
  }

  // Default to root handler
  try {
    await routes['GET /'](req, res);
  } catch (err) {
    error(res, 500, `Internal error: ${err}`);
  }
});

server.listen(PORT, () => {
  console.log(`🌾 SolanaYield API running on http://localhost:${PORT}`);
});
