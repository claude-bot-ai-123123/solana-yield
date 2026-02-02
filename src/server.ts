/**
 * SolanaYield HTTP API Server
 * Simple REST API for yield monitoring and quotes
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Connection } from '@solana/web3.js';
import { YieldMonitor } from './lib/monitor';
import { JupiterSwap, TOKENS } from './lib/jupiter';

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
      version: '0.1.0',
      endpoints: {
        '/yields': 'GET - All yield opportunities',
        '/yields/top': 'GET - Top 10 yields',
        '/yields/:protocol': 'GET - Yields for specific protocol',
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
