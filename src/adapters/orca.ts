import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

/**
 * Orca Adapter - Concentrated Liquidity AMM
 * 
 * Orca is Solana's leading AMM with concentrated liquidity (Whirlpools).
 * This adapter fetches yield opportunities from Orca pools.
 */
export class OrcaAdapter {
  private connection: Connection;
  private readonly ORCA_WHIRLPOOL_PROGRAM = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    try {
      // Fetch Orca pools from DeFi Llama
      const response = await fetch('https://yields.llama.fi/pools');
      const data = await response.json();
      
      const orcaPools = data.data
        .filter((p: any) => 
          p.chain === 'Solana' && 
          p.project?.toLowerCase().includes('orca') &&
          p.tvlUsd >= 100000 // Min $100k TVL
        )
        .sort((a: any, b: any) => b.tvlUsd - a.tvlUsd)
        .slice(0, 20) // Top 20 pools
        .map((p: any) => ({
          protocol: 'orca' as const,
          asset: p.symbol,
          type: 'liquidity' as const,
          apy: p.apy,
          tvl: p.tvlUsd,
          risk: this.assessRisk(p),
          chain: 'solana' as const,
          metadata: {
            description: `Orca Whirlpool: ${p.symbol}`,
            poolId: p.pool,
            stablecoin: p.stablecoin || false,
            ilRisk: p.ilRisk === 'yes',
            volume24h: p.volumeUsd1d,
            fees24h: p.apyBase1d ? (p.tvlUsd * p.apyBase1d / 100 / 365) : undefined,
          }
        }));

      return orcaPools;
    } catch (err) {
      console.error('Orca adapter error:', err);
      return this.getMockData();
    }
  }

  private assessRisk(pool: any): 'low' | 'medium' | 'high' {
    if (pool.stablecoin) return 'low';
    if (pool.ilRisk === 'yes' || pool.apy > 100) return 'high';
    if (pool.apy > 30) return 'medium';
    return 'low';
  }

  private getMockData(): YieldOpportunity[] {
    return [
      {
        protocol: 'orca',
        asset: 'SOL-USDC',
        type: 'liquidity',
        apy: 142.7,
        tvl: 30144509,
        risk: 'medium',
        chain: 'solana',
        metadata: {
          description: 'Orca Whirlpool: SOL-USDC',
          stablecoin: false,
          ilRisk: true,
        }
      },
      {
        protocol: 'orca',
        asset: 'SYRUPUSDC-USDC',
        type: 'liquidity',
        apy: 0.69,
        tvl: 30240231,
        risk: 'low',
        chain: 'solana',
        metadata: {
          description: 'Orca Whirlpool: SYRUPUSDC-USDC',
          stablecoin: true,
          ilRisk: false,
        }
      },
    ];
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    // Would need to query Whirlpool accounts for user positions
    // For MVP, returning empty
    return [];
  }

  /**
   * Get featured Orca pools with high TVL and reasonable risk
   */
  async getFeaturedPools(): Promise<YieldOpportunity[]> {
    const allYields = await this.getYields();
    
    return allYields
      .filter(y => y.tvl >= 1_000_000 && y.risk !== 'high')
      .slice(0, 5);
  }
}
