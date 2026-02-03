/**
 * SolanaYield HTTP API Server
 * Simple REST API for yield monitoring and quotes
 * Now with risk-adjusted recommendations!
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

const connection = new Connection('https://api.mainnet-beta.solana.com');
const monitor = new YieldMonitor(connection);
const jupiter = new JupiterSwap(connection);

const PORT = process.env.PORT || 3000;

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void>;
}

const routes: Record<string, RouteHandler> = {
  'GET /': async (req, res) => {
    json(res, {
      name: 'SolanaYield API',
      version: '0.2.0',
      description: 'Autonomous DeFi yield orchestrator with risk-adjusted recommendations',
      endpoints: {
        '/yields': 'GET - All yield opportunities (raw APY)',
        '/yields/top': 'GET - Top 10 by raw APY',
        '/yields/all': 'GET - All Solana yields',
        '/risk/analyze': 'GET - Risk-adjusted recommendations (?risk=medium&top=10)',
        '/risk/compare': 'GET - Compare raw APY vs risk-adjusted rankings',
        '/risk/protocols': 'GET - Protocol risk profiles',
        '/quote': 'GET - Swap quote (?from=SOL&to=USDC&amount=1)',
        '/health': 'GET - Health check',
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

const server = createServer(async (req, res) => {
  const method = req.method || 'GET';
  const path = (req.url || '/').split('?')[0];
  const routeKey = `${method} ${path}`;

  const handler = routes[routeKey] || routes['GET /'];
  
  try {
    await handler(req, res);
  } catch (err) {
    error(res, 500, `Internal error: ${err}`);
  }
});

server.listen(PORT, () => {
  console.log(`🌾 SolanaYield API running on http://localhost:${PORT}`);
});
