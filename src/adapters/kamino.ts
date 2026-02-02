import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

const KAMINO_API = 'https://api.kamino.finance';

export class KaminoAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    try {
      // Fetch Kamino vault data
      const response = await fetch(`${KAMINO_API}/strategies/metrics`);
      const data = await response.json();
      
      return data.map((vault: any) => ({
        protocol: 'kamino' as const,
        asset: vault.symbol || 'USDC',
        apy: vault.apy * 100 || 0,
        tvl: vault.tvl || 0,
        risk: this.assessRisk(vault),
        metadata: {
          vaultAddress: vault.address,
          strategy: vault.strategyType,
        },
      }));
    } catch (err) {
      console.warn('Kamino fetch failed, using fallback data');
      return this.getFallbackYields();
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    // TODO: Fetch actual positions from Kamino
    return [];
  }

  private assessRisk(vault: any): 'low' | 'medium' | 'high' {
    if (vault.strategyType === 'stable') return 'low';
    if (vault.leverage && vault.leverage > 2) return 'high';
    return 'medium';
  }

  private getFallbackYields(): YieldOpportunity[] {
    return [
      { protocol: 'kamino', asset: 'USDC', apy: 8.5, tvl: 50000000, risk: 'low' },
      { protocol: 'kamino', asset: 'SOL', apy: 12.3, tvl: 30000000, risk: 'medium' },
      { protocol: 'kamino', asset: 'JLP', apy: 45.2, tvl: 15000000, risk: 'high' },
    ];
  }
}
