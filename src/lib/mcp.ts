/**
 * MCP (Model Context Protocol) Integration
 * Exposes SolanaYield reasoning engine to other AI agents via standard protocol
 * 
 * Based on Anthropic's MCP spec: https://spec.modelcontextprotocol.io/
 */

import { IncomingMessage, ServerResponse } from 'http';
import { YieldMonitor } from './monitor';
import { getTopRecommendations, analyzeOpportunities } from './risk';
import { getHistoryStore } from './history';
import { Connection } from '@solana/web3.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    experimental?: Record<string, boolean>;
  };
}

/**
 * MCP Server for SolanaYield
 * Allows other AI agents to query yield recommendations via standard protocol
 */
export class MCPServer {
  private monitor: YieldMonitor;
  private historyStore: ReturnType<typeof getHistoryStore>;
  private connection: Connection;

  // SSE clients for live updates
  private sseClients: Set<ServerResponse> = new Set();

  constructor(connection: Connection) {
    this.connection = connection;
    this.monitor = new YieldMonitor(connection);
    this.historyStore = getHistoryStore(process.env.DECISION_DATA_DIR || './data/decisions');

    // Broadcast yield updates every 60 seconds
    setInterval(() => this.broadcastYieldUpdate(), 60000);
  }

  /**
   * Get MCP server info (capabilities)
   */
  getServerInfo(): MCPServerInfo {
    return {
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
    };
  }

  /**
   * List available tools (functions other agents can call)
   */
  listTools(): MCPTool[] {
    return [
      {
        name: 'get_yield_recommendations',
        description: 'Get risk-adjusted yield recommendations for Solana DeFi protocols. Returns top opportunities sorted by risk-adjusted APY (not raw APY).',
        inputSchema: {
          type: 'object',
          properties: {
            riskTolerance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Risk tolerance level (low: max 35/100, medium: max 55/100, high: max 75/100)',
            },
            topN: {
              type: 'number',
              description: 'Number of top recommendations to return',
              default: 10,
            },
            minTvl: {
              type: 'number',
              description: 'Minimum TVL in USD',
            },
            assets: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by specific assets (e.g., ["USDC", "SOL"])',
            },
          },
          required: ['riskTolerance'],
        },
      },
      {
        name: 'analyze_protocol_risk',
        description: 'Get detailed risk analysis for a specific DeFi protocol including smart contract risk, liquidity, sustainability, and historical performance.',
        inputSchema: {
          type: 'object',
          properties: {
            protocol: {
              type: 'string',
              description: 'Protocol name (e.g., "Kamino", "Drift", "Jito")',
            },
          },
          required: ['protocol'],
        },
      },
      {
        name: 'query_decision_history',
        description: 'Query the decision audit trail. Returns detailed reasoning, execution status, and outcomes of past yield decisions.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['rebalance', 'enter', 'exit', 'monitor'],
              description: 'Type of decision to query',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of decisions to return',
              default: 20,
            },
            minConfidence: {
              type: 'number',
              description: 'Minimum confidence score (0-1)',
            },
          },
        },
      },
      {
        name: 'get_market_snapshot',
        description: 'Get current snapshot of all Solana yield opportunities with real-time APY, TVL, and protocol health metrics.',
        inputSchema: {
          type: 'object',
          properties: {
            includeRiskScores: {
              type: 'boolean',
              description: 'Include detailed risk analysis for each opportunity',
              default: true,
            },
          },
        },
      },
      {
        name: 'compare_strategies',
        description: 'Compare different yield strategies (naive vs risk-adjusted). Shows how risk-adjusted ranking differs from raw APY sorting.',
        inputSchema: {
          type: 'object',
          properties: {
            topN: {
              type: 'number',
              description: 'Number of opportunities to compare',
              default: 5,
            },
          },
        },
      },
    ];
  }

  /**
   * List available resources (data other agents can access)
   */
  listResources(): MCPResource[] {
    return [
      {
        uri: 'solanayield://yields/all',
        name: 'All Yield Opportunities',
        description: 'Complete list of current Solana DeFi yield opportunities',
        mimeType: 'application/json',
      },
      {
        uri: 'solanayield://risk-profiles/protocols',
        name: 'Protocol Risk Profiles',
        description: 'Risk scoring methodology and protocol profiles',
        mimeType: 'application/json',
      },
      {
        uri: 'solanayield://audit/stats',
        name: 'Decision Statistics',
        description: 'Aggregate statistics on decision history and performance',
        mimeType: 'application/json',
      },
      {
        uri: 'solanayield://audit/timeline',
        name: 'Decision Timeline',
        description: 'Historical timeline of yield decisions',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * List available prompts (templates for common queries)
   */
  listPrompts(): MCPPrompt[] {
    return [
      {
        name: 'recommend_conservative_yield',
        description: 'Get conservative yield recommendations suitable for risk-averse users',
        arguments: [
          {
            name: 'amount',
            description: 'Amount in USD to invest',
            required: true,
          },
        ],
      },
      {
        name: 'analyze_protocol_safety',
        description: 'Comprehensive safety analysis of a DeFi protocol',
        arguments: [
          {
            name: 'protocol',
            description: 'Protocol name to analyze',
            required: true,
          },
        ],
      },
      {
        name: 'explain_recommendation',
        description: 'Explain reasoning behind a specific yield recommendation',
        arguments: [
          {
            name: 'protocol',
            description: 'Protocol name',
            required: true,
          },
          {
            name: 'asset',
            description: 'Asset name',
            required: true,
          },
        ],
      },
    ];
  }

  /**
   * Execute a tool call from another agent
   */
  async callTool(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'get_yield_recommendations': {
        const { riskTolerance = 'medium', topN = 10, minTvl, assets } = args;
        const maxRisk = riskTolerance === 'low' ? 35 : riskTolerance === 'high' ? 75 : 55;

        const yields = await this.monitor.fetchAllSolanaOpportunities();
        let recommendations = getTopRecommendations(yields, topN * 2, maxRisk);

        // Apply filters
        if (minTvl) {
          recommendations = recommendations.filter(r => r.tvl >= minTvl);
        }
        if (assets && assets.length > 0) {
          const assetSet = new Set(assets.map((a: string) => a.toUpperCase()));
          recommendations = recommendations.filter(r => assetSet.has(r.asset.toUpperCase()));
        }

        return {
          strategy: {
            riskTolerance,
            maxRiskScore: maxRisk,
            description: 'Risk-adjusted recommendations (not sorted by raw APY)',
          },
          count: recommendations.slice(0, topN).length,
          recommendations: recommendations.slice(0, topN).map(r => ({
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
        };
      }

      case 'analyze_protocol_risk': {
        const { protocol } = args;
        const yields = await this.monitor.fetchAllSolanaOpportunities();
        const analyzed = analyzeOpportunities(yields);
        
        const protocolYields = analyzed.filter(y => 
          y.protocol.toLowerCase() === protocol.toLowerCase()
        );

        if (protocolYields.length === 0) {
          throw new Error(`Protocol not found: ${protocol}`);
        }

        // Aggregate risk scores across all protocol yields
        const avgRiskScore = protocolYields.reduce((sum, y) => sum + y.riskScore.overall, 0) / protocolYields.length;
        const allWarnings = [...new Set(protocolYields.flatMap(y => y.riskScore.warnings))];
        const allPositives = [...new Set(protocolYields.flatMap(y => y.riskScore.positives))];

        return {
          protocol,
          averageRiskScore: Math.round(avgRiskScore),
          opportunities: protocolYields.map(y => ({
            asset: y.asset,
            rawApy: y.apy,
            riskAdjustedApy: y.adjustedApy,
            tvl: y.tvl,
            riskScore: y.riskScore.overall,
          })),
          riskFactors: protocolYields[0].riskScore.factors,
          warnings: allWarnings,
          positives: allPositives,
          summary: `${protocol} has an average risk score of ${Math.round(avgRiskScore)}/100 across ${protocolYields.length} yield opportunities.`,
        };
      }

      case 'query_decision_history': {
        const { type, limit = 20, minConfidence } = args;
        
        const decisions = await this.historyStore.query({
          types: type ? [type] : undefined,
          limit,
          minConfidence,
        });

        return {
          count: decisions.length,
          decisions: decisions.map(d => ({
            id: d.id,
            timestamp: new Date(d.decision.timestamp).toISOString(),
            type: d.decision.type,
            confidence: d.decision.confidence,
            executed: d.decision.executed,
            protocols: d.meta.protocols,
            assets: d.meta.assets,
            apyImpact: d.meta.apyImpact,
            reasoning: d.decision.reasoning,
            actions: d.decision.actions,
          })),
        };
      }

      case 'get_market_snapshot': {
        const { includeRiskScores = true } = args;
        const yields = await this.monitor.fetchAllSolanaOpportunities();

        if (includeRiskScores) {
          const analyzed = analyzeOpportunities(yields);
          return {
            timestamp: new Date().toISOString(),
            count: analyzed.length,
            opportunities: analyzed.map(y => ({
              protocol: y.protocol,
              asset: y.asset,
              rawApy: y.apy,
              riskAdjustedApy: y.adjustedApy,
              tvl: y.tvl,
              riskScore: y.riskScore.overall,
            })),
          };
        } else {
          return {
            timestamp: new Date().toISOString(),
            count: yields.length,
            opportunities: yields.map(y => ({
              protocol: y.protocol,
              asset: y.asset,
              apy: y.apy,
              tvl: y.tvl,
            })),
          };
        }
      }

      case 'compare_strategies': {
        const { topN = 5 } = args;
        const yields = await this.monitor.fetchAllSolanaOpportunities();
        const analyzed = analyzeOpportunities(yields);

        // Naive: sort by raw APY
        const byRawApy = [...analyzed]
          .sort((a, b) => b.apy - a.apy)
          .slice(0, topN)
          .map((o, i) => ({
            rank: i + 1,
            protocol: o.protocol,
            asset: o.asset,
            rawApy: parseFloat(o.apy.toFixed(2)),
            riskScore: o.riskScore.overall,
            warnings: o.riskScore.warnings,
          }));

        // Smart: sort by risk-adjusted APY
        const byAdjusted = [...analyzed]
          .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
          .slice(0, topN)
          .map((o, i) => ({
            rank: i + 1,
            protocol: o.protocol,
            asset: o.asset,
            rawApy: parseFloat(o.apy.toFixed(2)),
            riskAdjustedApy: parseFloat(o.adjustedApy.toFixed(2)),
            sharpeRatio: parseFloat(o.sharpeRatio.toFixed(2)),
            riskScore: o.riskScore.overall,
          }));

        return {
          naive: {
            strategy: 'Sort by highest raw APY (ignores risk)',
            results: byRawApy,
          },
          smart: {
            strategy: 'Sort by Sharpe ratio (risk-adjusted returns)',
            results: byAdjusted,
          },
          difference: `${Math.abs(byRawApy.findIndex(r => r.protocol === byAdjusted[0].protocol && r.asset === byAdjusted[0].asset) - 0)} positions shifted for top recommendation`,
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Handle MCP protocol requests
   */
  async handleMCPRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '', 'http://localhost');
    const path = url.pathname;

    // Enable CORS for MCP clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      switch (path) {
        case '/mcp/info':
          this.jsonResponse(res, this.getServerInfo());
          break;

        case '/mcp/tools/list':
          this.jsonResponse(res, { tools: this.listTools() });
          break;

        case '/mcp/resources/list':
          this.jsonResponse(res, { resources: this.listResources() });
          break;

        case '/mcp/prompts/list':
          this.jsonResponse(res, { prompts: this.listPrompts() });
          break;

        case '/mcp/tools/call':
          if (req.method !== 'POST') {
            throw new Error('POST required for tool calls');
          }
          const toolRequest = await this.parseRequestBody(req);
          const result = await this.callTool(toolRequest.name, toolRequest.arguments || {});
          this.jsonResponse(res, { result });
          break;

        case '/mcp/stream':
          // SSE endpoint for live updates
          this.handleSSE(req, res);
          break;

        default:
          this.errorResponse(res, 404, 'MCP endpoint not found');
      }
    } catch (err: any) {
      this.errorResponse(res, 500, err.message);
    }
  }

  /**
   * Handle Server-Sent Events for real-time updates
   */
  private handleSSE(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Add client to set
    this.sseClients.add(res);

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // Remove client on close
    req.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  /**
   * Broadcast yield update to all SSE clients
   */
  private async broadcastYieldUpdate(): Promise<void> {
    if (this.sseClients.size === 0) return;

    try {
      const yields = await this.monitor.fetchAllYields();
      const top5 = yields.slice(0, 5).map(y => ({
        protocol: y.protocol,
        asset: y.asset,
        apy: y.apy,
        tvl: y.tvl,
      }));

      const event = {
        type: 'yield_update',
        timestamp: Date.now(),
        data: { top5, total: yields.length },
      };

      const message = `data: ${JSON.stringify(event)}\n\n`;
      
      for (const client of this.sseClients) {
        try {
          client.write(message);
        } catch {
          this.sseClients.delete(client);
        }
      }
    } catch (err) {
      console.error('Failed to broadcast yield update:', err);
    }
  }

  private jsonResponse(res: ServerResponse, data: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  private errorResponse(res: ServerResponse, code: number, message: string): void {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  private parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  }
}
