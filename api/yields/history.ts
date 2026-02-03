import { createClient } from '@libsql/client';

export const config = {
  runtime: 'edge',
};

// Turso client
function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  });
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const pool = url.searchParams.get('pool');
  const protocol = url.searchParams.get('protocol');
  const asset = url.searchParams.get('asset');
  const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 30);
  const format = url.searchParams.get('format') || 'full'; // 'full' or 'sparkline'

  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

  try {
    // Query by pool ID
    if (pool) {
      const result = await db.execute({
        sql: `SELECT timestamp, apy, tvl FROM yield_snapshots WHERE pool_id = ? AND timestamp > ? ORDER BY timestamp ASC`,
        args: [pool, cutoff]
      });

      const history = result.rows.map(row => ({
        timestamp: (row.timestamp as number) * 1000,
        date: new Date((row.timestamp as number) * 1000).toISOString(),
        apy: row.apy as number,
        tvl: row.tvl as number
      }));

      if (history.length === 0) {
        return new Response(JSON.stringify({
          pool,
          days,
          dataPoints: 0,
          history: [],
          message: 'No historical data found. Data collection started recently - check back in an hour.',
          hint: 'Trigger /api/cron/snapshot to populate data immediately.'
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Calculate stats
      const apys = history.map(h => h.apy);
      const stats = {
        avgApy: apys.reduce((a, b) => a + b, 0) / apys.length,
        maxApy: Math.max(...apys),
        minApy: Math.min(...apys),
        volatility: calculateVolatility(apys),
        trend: history.length > 1 ? ((history[history.length - 1].apy - history[0].apy) / history[0].apy * 100) : 0
      };

      if (format === 'sparkline') {
        // Return just APY values for sparkline rendering
        return new Response(JSON.stringify({
          pool,
          days,
          sparkline: apys,
          trend: stats.trend
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
        });
      }

      return new Response(JSON.stringify({
        pool,
        days,
        dataPoints: history.length,
        history,
        stats
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Query by protocol + asset
    if (protocol || asset) {
      let sql = `SELECT timestamp, protocol, asset, pool_id, apy, tvl FROM yield_snapshots WHERE timestamp > ?`;
      const args: any[] = [cutoff];

      if (protocol) {
        sql += ` AND LOWER(protocol) LIKE ?`;
        args.push(`%${protocol.toLowerCase()}%`);
      }
      if (asset) {
        sql += ` AND LOWER(asset) LIKE ?`;
        args.push(`%${asset.toLowerCase()}%`);
      }

      sql += ` ORDER BY timestamp DESC LIMIT 1000`;

      const result = await db.execute({ sql, args });

      // Group by pool
      const grouped = new Map<string, any[]>();
      for (const row of result.rows) {
        const key = row.pool_id as string || `${row.protocol}:${row.asset}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push({
          timestamp: (row.timestamp as number) * 1000,
          apy: row.apy as number,
          tvl: row.tvl as number
        });
      }

      const pools = Array.from(grouped.entries()).map(([poolId, history]) => {
        const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
        const apys = sorted.map(h => h.apy);
        return {
          poolId,
          dataPoints: sorted.length,
          latestApy: sorted[sorted.length - 1]?.apy,
          trend: sorted.length > 1 ? ((sorted[sorted.length - 1].apy - sorted[0].apy) / sorted[0].apy * 100) : 0,
          sparkline: format === 'sparkline' ? apys : undefined,
          history: format === 'full' ? sorted : undefined
        };
      });

      return new Response(JSON.stringify({
        filters: { protocol, asset, days },
        poolCount: pools.length,
        pools
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Bulk sparklines for UI (all pools, last 7 days)
    if (format === 'sparkline') {
      const result = await db.execute({
        sql: `
          SELECT pool_id, protocol, asset, timestamp, apy 
          FROM yield_snapshots 
          WHERE timestamp > ? 
          ORDER BY pool_id, timestamp ASC
        `,
        args: [cutoff]
      });

      const sparklines = new Map<string, { protocol: string; asset: string; apys: number[] }>();
      
      for (const row of result.rows) {
        const key = row.pool_id as string || `${row.protocol}:${row.asset}`;
        if (!sparklines.has(key)) {
          sparklines.set(key, {
            protocol: row.protocol as string,
            asset: row.asset as string,
            apys: []
          });
        }
        sparklines.get(key)!.apys.push(row.apy as number);
      }

      const data: Record<string, { protocol: string; asset: string; sparkline: number[]; trend: number }> = {};
      for (const [key, val] of sparklines) {
        const trend = val.apys.length > 1 
          ? ((val.apys[val.apys.length - 1] - val.apys[0]) / val.apys[0] * 100) 
          : 0;
        data[key] = {
          protocol: val.protocol,
          asset: val.asset,
          sparkline: val.apys,
          trend
        };
      }

      return new Response(JSON.stringify({
        days,
        poolCount: Object.keys(data).length,
        sparklines: data
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // No filters - return usage info
    return new Response(JSON.stringify({
      endpoint: '/api/yields/history',
      description: 'Historical yield data from Turso SQLite database',
      dataSource: 'Hourly snapshots of DeFi Llama Solana yields',
      usage: {
        byPool: '/api/yields/history?pool=<pool-uuid>&days=7',
        byProtocol: '/api/yields/history?protocol=kamino&days=7',
        byAsset: '/api/yields/history?asset=USDC&days=7',
        sparklines: '/api/yields/history?format=sparkline&days=7',
        combined: '/api/yields/history?protocol=drift&asset=SOL&days=7'
      },
      parameters: {
        pool: 'Pool UUID from /api/yields response',
        protocol: 'Protocol name filter (kamino, drift, jito, etc)',
        asset: 'Asset symbol filter (SOL, USDC, etc)',
        days: 'Number of days of history (default: 7, max: 30)',
        format: '"full" (default) or "sparkline" (just APY arrays)'
      },
      limits: {
        maxDays: 30,
        dataRetention: '30 days',
        snapshotFrequency: 'hourly'
      },
      poweredBy: 'Turso SQLite + DeFi Llama',
      builder: 'SolanaYield - Colosseum Agent Hackathon'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('History API error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch historical data',
      details: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Database may not be initialized. Try /api/cron/snapshot?action=init first.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}
