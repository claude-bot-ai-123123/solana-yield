export const config = {
  runtime: 'edge',
};

interface HistoricalYield {
  timestamp: number;
  date: string;
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
}

// DeFi Llama historical yields endpoint
const DEFILLAMA_HISTORY_URL = 'https://yields.llama.fi/chart';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const pool = url.searchParams.get('pool');
  const protocol = url.searchParams.get('protocol');
  const asset = url.searchParams.get('asset');
  const days = parseInt(url.searchParams.get('days') || '30');

  // If specific pool UUID provided, fetch its history
  if (pool) {
    try {
      const response = await fetch(`${DEFILLAMA_HISTORY_URL}/${pool}`);
      if (!response.ok) {
        return new Response(JSON.stringify({ 
          error: 'Pool not found',
          hint: 'Use /api/yields to get valid pool IDs'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const data = await response.json();
      
      // Filter to requested days
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      const filtered = (data.data || []).filter((d: any) => 
        new Date(d.timestamp).getTime() > cutoff
      );

      return new Response(JSON.stringify({
        pool,
        days,
        dataPoints: filtered.length,
        history: filtered.map((d: any) => ({
          timestamp: new Date(d.timestamp).getTime(),
          date: d.timestamp,
          apy: d.apy,
          tvl: d.tvlUsd,
          apyBase: d.apyBase,
          apyReward: d.apyReward,
        })),
        stats: {
          avgApy: filtered.reduce((sum: number, d: any) => sum + (d.apy || 0), 0) / filtered.length,
          maxApy: Math.max(...filtered.map((d: any) => d.apy || 0)),
          minApy: Math.min(...filtered.map((d: any) => d.apy || 0)),
          volatility: calculateVolatility(filtered.map((d: any) => d.apy || 0)),
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300' // 5 min cache
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch historical data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // If protocol/asset provided, find matching pools and aggregate
  if (protocol || asset) {
    try {
      // First get current yields to find matching pools
      const yieldsResponse = await fetch('https://yields.llama.fi/pools');
      const yieldsData = await yieldsResponse.json();
      
      let pools = yieldsData.data || [];
      
      if (protocol) {
        pools = pools.filter((p: any) => 
          p.project.toLowerCase().includes(protocol.toLowerCase())
        );
      }
      
      if (asset) {
        pools = pools.filter((p: any) => 
          p.symbol.toLowerCase().includes(asset.toLowerCase())
        );
      }

      // Limit to top 5 by TVL to avoid rate limits
      pools = pools
        .sort((a: any, b: any) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
        .slice(0, 5);

      if (pools.length === 0) {
        return new Response(JSON.stringify({
          error: 'No matching pools found',
          filters: { protocol, asset }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        filters: { protocol, asset, days },
        matchingPools: pools.map((p: any) => ({
          pool: p.pool,
          project: p.project,
          symbol: p.symbol,
          tvl: p.tvlUsd,
          currentApy: p.apy,
          historyUrl: `/api/yields/history?pool=${p.pool}&days=${days}`
        })),
        hint: 'Use the historyUrl for each pool to get detailed historical data'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to search pools',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // No filters - return usage info
  return new Response(JSON.stringify({
    endpoint: '/api/yields/history',
    description: 'Historical yield data for backtesting and analysis',
    usage: {
      byPool: '/api/yields/history?pool=<pool-uuid>&days=30',
      byProtocol: '/api/yields/history?protocol=kamino&days=7',
      byAsset: '/api/yields/history?asset=USDC&days=14',
      combined: '/api/yields/history?protocol=drift&asset=SOL&days=30'
    },
    parameters: {
      pool: 'Pool UUID from /api/yields response',
      protocol: 'Protocol name filter (kamino, drift, jito, etc)',
      asset: 'Asset symbol filter (SOL, USDC, etc)',
      days: 'Number of days of history (default: 30, max: 365)'
    },
    response: {
      history: 'Array of {timestamp, date, apy, tvl, apyBase, apyReward}',
      stats: '{avgApy, maxApy, minApy, volatility}'
    },
    poweredBy: 'DeFi Llama',
    builder: 'SolanaYield - Colosseum Agent Hackathon'
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  });
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}
