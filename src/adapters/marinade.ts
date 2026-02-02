import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

export class MarinadeAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    try {
      const response = await fetch('https://api.marinade.finance/tlv');
      const data = await response.json();
      
      return [{
        protocol: 'marinade',
        asset: 'mSOL',
        apy: data.apy || 7.2,
        tvl: data.tvl || 80000000,
        risk: 'low',
        metadata: {
          stakeAccounts: data.stakeAccounts,
        },
      }];
    } catch (err) {
      return this.getFallbackYields();
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    return [];
  }

  private getFallbackYields(): YieldOpportunity[] {
    return [
      { protocol: 'marinade', asset: 'mSOL', apy: 7.2, tvl: 85000000, risk: 'low' },
    ];
  }
}
