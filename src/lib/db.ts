import { createClient } from '@libsql/client';

// Turso SQLite client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export interface YieldSnapshot {
  id?: number;
  timestamp: number;
  protocol: string;
  asset: string;
  pool_id: string | null;
  apy: number;
  tvl: number | null;
  created_at?: number;
}

// Initialize schema (run once)
export async function initSchema(): Promise<void> {
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
  
  // Create indexes if they don't exist
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_time ON yield_snapshots(timestamp DESC)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_protocol ON yield_snapshots(protocol, asset)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_snapshots_pool ON yield_snapshots(pool_id)`);
}

// Insert yield snapshots (batch)
export async function insertSnapshots(snapshots: Omit<YieldSnapshot, 'id' | 'created_at'>[]): Promise<number> {
  if (snapshots.length === 0) return 0;
  
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Batch insert using transaction
  const tx = await db.transaction('write');
  try {
    for (const s of snapshots) {
      await tx.execute({
        sql: `INSERT INTO yield_snapshots (timestamp, protocol, asset, pool_id, apy, tvl) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [timestamp, s.protocol, s.asset, s.pool_id, s.apy, s.tvl]
      });
    }
    await tx.commit();
    return snapshots.length;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

// Get historical data for a specific pool
export async function getPoolHistory(poolId: string, days: number = 7): Promise<YieldSnapshot[]> {
  const cutoff = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  const result = await db.execute({
    sql: `SELECT * FROM yield_snapshots WHERE pool_id = ? AND timestamp > ? ORDER BY timestamp ASC`,
    args: [poolId, cutoff]
  });
  
  return result.rows.map(row => ({
    id: row.id as number,
    timestamp: row.timestamp as number,
    protocol: row.protocol as string,
    asset: row.asset as string,
    pool_id: row.pool_id as string | null,
    apy: row.apy as number,
    tvl: row.tvl as number | null,
    created_at: row.created_at as number
  }));
}

// Get historical data for protocol + asset combo
export async function getAssetHistory(protocol: string, asset: string, days: number = 7): Promise<YieldSnapshot[]> {
  const cutoff = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  const result = await db.execute({
    sql: `SELECT * FROM yield_snapshots WHERE protocol = ? AND asset = ? AND timestamp > ? ORDER BY timestamp ASC`,
    args: [protocol, asset, cutoff]
  });
  
  return result.rows.map(row => ({
    id: row.id as number,
    timestamp: row.timestamp as number,
    protocol: row.protocol as string,
    asset: row.asset as string,
    pool_id: row.pool_id as string | null,
    apy: row.apy as number,
    tvl: row.tvl as number | null,
    created_at: row.created_at as number
  }));
}

// Get latest snapshot for each pool (for sparklines)
export async function getLatestSnapshots(days: number = 7): Promise<Map<string, YieldSnapshot[]>> {
  const cutoff = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  const result = await db.execute({
    sql: `SELECT * FROM yield_snapshots WHERE timestamp > ? ORDER BY protocol, asset, timestamp ASC`,
    args: [cutoff]
  });
  
  const grouped = new Map<string, YieldSnapshot[]>();
  
  for (const row of result.rows) {
    const key = `${row.protocol}:${row.asset}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push({
      id: row.id as number,
      timestamp: row.timestamp as number,
      protocol: row.protocol as string,
      asset: row.asset as string,
      pool_id: row.pool_id as string | null,
      apy: row.apy as number,
      tvl: row.tvl as number | null,
      created_at: row.created_at as number
    });
  }
  
  return grouped;
}

// Cleanup old data (keep last N days)
export async function cleanupOldData(keepDays: number = 30): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - (keepDays * 24 * 60 * 60);
  
  const result = await db.execute({
    sql: `DELETE FROM yield_snapshots WHERE timestamp < ?`,
    args: [cutoff]
  });
  
  return result.rowsAffected;
}

// Get stats
export async function getStats(): Promise<{ totalRows: number; oldestTimestamp: number | null; newestTimestamp: number | null }> {
  const result = await db.execute(`
    SELECT 
      COUNT(*) as total,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM yield_snapshots
  `);
  
  const row = result.rows[0];
  return {
    totalRows: (row.total as number) || 0,
    oldestTimestamp: row.oldest as number | null,
    newestTimestamp: row.newest as number | null
  };
}

export { db };
