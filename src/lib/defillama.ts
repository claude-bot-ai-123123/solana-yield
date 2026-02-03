/**
 * DeFi Llama integration for yield data
 * This is more reliable than individual protocol APIs
 */

import { YieldOpportunity } from '../types';

const LLAMA_YIELDS_API = 'https://yields.llama.fi/pools';

interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  stablecoin: boolean;
  ilRisk: string;
}

// Map DeFi Llama project names to our protocol names
const PROJECT_MAP: Record<string, 'kamino' | 'drift' | 'jito' | 'marinade' | 'mango'> = {
  'kamino-lend': 'kamino',
  'kamino': 'kamino',
  'drift': 'drift',
  'jito': 'jito',
  'marinade-finance': 'marinade',
  'marinade': 'marinade',
  'mango-markets': 'mango',
  'mango': 'mango',
};

export async function fetchSolanaYields(
  minTvl: number = 100000
): Promise<YieldOpportunity[]> {
  const response = await fetch(LLAMA_YIELDS_API);
  const data = await response.json();
  
  const solanaPools: LlamaPool[] = data.data.filter(
    (pool: LlamaPool) => 
      pool.chain === 'Solana' && 
      pool.tvlUsd >= minTvl &&
      pool.apy > 0
  );

  return solanaPools
    .map((pool): YieldOpportunity | null => {
      const protocol = PROJECT_MAP[pool.project.toLowerCase()];
      if (!protocol) return null; // Skip protocols we don't support
      
      return {
        protocol,
        asset: pool.symbol,
        apy: pool.apy,
        tvl: pool.tvlUsd,
        risk: assessRisk(pool),
        metadata: {
          poolId: pool.pool,
          project: pool.project,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          stablecoin: pool.stablecoin,
        },
      };
    })
    .filter((o): o is YieldOpportunity => o !== null)
    .sort((a, b) => b.apy - a.apy);
}

function assessRisk(pool: LlamaPool): 'low' | 'medium' | 'high' {
  // Stablecoins are generally lower risk
  if (pool.stablecoin) return 'low';
  
  // High IL risk means higher overall risk
  if (pool.ilRisk === 'yes') return 'high';
  
  // Very high APY usually means higher risk
  if (pool.apy > 50) return 'high';
  if (pool.apy > 20) return 'medium';
  
  return 'medium';
}

// Fetch all Solana yields (not just our supported protocols)
export async function fetchAllSolanaYields(
  minTvl: number = 100000
): Promise<YieldOpportunity[]> {
  const response = await fetch(LLAMA_YIELDS_API);
  const data = await response.json();
  
  return data.data
    .filter((pool: LlamaPool) => 
      pool.chain === 'Solana' && 
      pool.tvlUsd >= minTvl &&
      pool.apy > 0
    )
    .map((pool: LlamaPool): YieldOpportunity => ({
      protocol: pool.project as any,
      asset: pool.symbol,
      apy: pool.apy,
      tvl: pool.tvlUsd,
      risk: assessRisk(pool),
      metadata: {
        poolId: pool.pool,
        stablecoin: pool.stablecoin,
      },
    }))
    .sort((a: YieldOpportunity, b: YieldOpportunity) => b.apy - a.apy);
}
