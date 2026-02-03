import { createClient } from '@libsql/client';

export const config = {
  runtime: 'edge',
};

// DeFi Llama pools endpoint
const DEFILLAMA_URL = 'https://yields.llama.fi/pools';

// Turso client (edge-compatible)
function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  });
}

// Initialize schema
async function initSchema(db: ReturnType<typeof createClient>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS yield_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      protocol TEXT NOT NULL,
      asset TEXT NOT NULL,
      pool_id TEXT,
      apy REAL NOT NULL,
      tvl REAL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_time ON yield_snapshots(timestamp DESC)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_protocol ON yield_snapshots(protocol, asset)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_pool ON yield_snapshots(pool_id)`);
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'snapshot';
  const secret = url.searchParams.get('secret');
  
  // Simple auth check (optional - set CRON_SECRET env var)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  try {
    // Always ensure schema exists
    await initSchema(db);

    if (action === 'init') {
      // Just initialize schema
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Schema initialized' 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'stats') {
      // Get database stats
      const result = await db.execute(`
        SELECT 
          COUNT(*) as total,
          MIN(timestamp) as oldest,
          MAX(timestamp) as newest
        FROM yield_snapshots
      `);
      const row = result.rows[0];
      
      return new Response(JSON.stringify({
        totalRows: row.total,
        oldestTimestamp: row.oldest,
        newestTimestamp: row.newest,
        oldestDate: row.oldest ? new Date((row.oldest as number) * 1000).toISOString() : null,
        newestDate: row.newest ? new Date((row.newest as number) * 1000).toISOString() : null,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cleanup') {
      // Delete old data (keep 30 days)
      const cutoff = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      const result = await db.execute({
        sql: `DELETE FROM yield_snapshots WHERE timestamp < ?`,
        args: [cutoff]
      });
      
      return new Response(JSON.stringify({
        success: true,
        deletedRows: result.rowsAffected,
        cutoffDate: new Date(cutoff * 1000).toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: snapshot current yields
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Fetch current yields from DeFi Llama
    const response = await fetch(DEFILLAMA_URL);
    if (!response.ok) {
      throw new Error(`DeFi Llama API error: ${response.status}`);
    }
    
    const data = await response.json();
    const pools = data.data || [];
    
    // Filter to Solana pools
    const solanaPools = pools.filter((p: any) => 
      p.chain === 'Solana' && 
      p.apy != null && 
      p.tvlUsd > 10000 // Only pools with >$10k TVL
    );
    
    // Limit to top 200 by TVL to stay within write limits
    const topPools = solanaPools
      .sort((a: any, b: any) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      .slice(0, 200);
    
    // Batch insert
    let inserted = 0;
    const batchSize = 50;
    
    for (let i = 0; i < topPools.length; i += batchSize) {
      const batch = topPools.slice(i, i + batchSize);
      const values = batch.map((p: any) => 
        `(${timestamp}, '${p.project.replace(/'/g, "''")}', '${p.symbol.replace(/'/g, "''")}', '${p.pool}', ${p.apy}, ${p.tvlUsd || 0})`
      ).join(',');
      
      await db.execute(`
        INSERT INTO yield_snapshots (timestamp, protocol, asset, pool_id, apy, tvl)
        VALUES ${values}
      `);
      inserted += batch.length;
    }
    
    return new Response(JSON.stringify({
      success: true,
      timestamp,
      date: new Date(timestamp * 1000).toISOString(),
      poolsFound: solanaPools.length,
      poolsInserted: inserted,
      message: `Snapshotted ${inserted} Solana yield pools`
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
    });
    
  } catch (error) {
    console.error('Snapshot error:', error);
    return new Response(JSON.stringify({
      error: 'Snapshot failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
