import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Portfolio, Position } from '../types';
import { KaminoAdapter } from '../adapters/kamino';
import { DriftAdapter } from '../adapters/drift';
import { JitoAdapter } from '../adapters/jito';
import { MarinadeAdapter } from '../adapters/marinade';

export class YieldMonitor {
  private connection: Connection;
  private adapters: {
    kamino: KaminoAdapter;
    drift: DriftAdapter;
    jito: JitoAdapter;
    marinade: MarinadeAdapter;
  };

  constructor(connection: Connection) {
    this.connection = connection;
    this.adapters = {
      kamino: new KaminoAdapter(connection),
      drift: new DriftAdapter(connection),
      jito: new JitoAdapter(connection),
      marinade: new MarinadeAdapter(connection),
    };
  }

  async fetchAllYields(): Promise<YieldOpportunity[]> {
    const results = await Promise.allSettled([
      this.adapters.kamino.getYields(),
      this.adapters.drift.getYields(),
      this.adapters.jito.getYields(),
      this.adapters.marinade.getYields(),
    ]);

    return results
      .filter((r): r is PromiseFulfilledResult<YieldOpportunity[]> => 
        r.status === 'fulfilled'
      )
      .flatMap(r => r.value)
      .sort((a, b) => b.apy - a.apy);
  }

  async getPortfolio(wallet: PublicKey): Promise<Portfolio> {
    const positions: Position[] = [];
    
    for (const [protocol, adapter] of Object.entries(this.adapters)) {
      const protocolPositions = await adapter.getPositions(wallet);
      positions.push(...protocolPositions);
    }

    const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const weightedApy = totalValue > 0
      ? positions.reduce((sum, p) => sum + (p.currentApy * p.valueUsd), 0) / totalValue
      : 0;

    return { positions, totalValue, weightedApy };
  }
}
