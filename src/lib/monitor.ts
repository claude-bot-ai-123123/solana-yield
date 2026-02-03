import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Portfolio, Position } from '../types';
import { fetchSolanaYields, fetchAllSolanaYields } from './defillama';
import { KaminoAdapter } from '../adapters/kamino';
import { DriftAdapter } from '../adapters/drift';
import { JitoAdapter } from '../adapters/jito';
import { MarinadeAdapter } from '../adapters/marinade';
import { MangoAdapter } from '../adapters/mango';
import { FundingRateAdapter } from '../adapters/funding';
import { PumpAdapter } from '../adapters/pump';
import { OrcaAdapter } from '../adapters/orca';

export class YieldMonitor {
  private connection: Connection;
  private adapters: {
    kamino: KaminoAdapter;
    drift: DriftAdapter;
    jito: JitoAdapter;
    marinade: MarinadeAdapter;
    mango: MangoAdapter;
    funding: FundingRateAdapter;
    pump: PumpAdapter;
    orca: OrcaAdapter;
  };

  constructor(connection: Connection) {
    this.connection = connection;
    this.adapters = {
      kamino: new KaminoAdapter(connection),
      drift: new DriftAdapter(connection),
      jito: new JitoAdapter(connection),
      marinade: new MarinadeAdapter(connection),
      mango: new MangoAdapter(connection),
      funding: new FundingRateAdapter(connection),
      pump: new PumpAdapter(connection),
      orca: new OrcaAdapter(connection),
    };
  }

  /**
   * Fetch yields from our supported protocols via DeFi Llama
   */
  async fetchAllYields(): Promise<YieldOpportunity[]> {
    try {
      return await fetchSolanaYields(100000); // Min $100k TVL
    } catch (err) {
      console.warn('DeFi Llama fetch failed, using adapter fallbacks');
      return this.fetchFromAdapters();
    }
  }

  /**
   * Fetch ALL Solana yields (including protocols we don't have adapters for)
   */
  async fetchAllSolanaOpportunities(): Promise<YieldOpportunity[]> {
    return fetchAllSolanaYields(100000);
  }

  private async fetchFromAdapters(): Promise<YieldOpportunity[]> {
    const results = await Promise.allSettled([
      this.adapters.kamino.getYields(),
      this.adapters.drift.getYields(),
      this.adapters.jito.getYields(),
      this.adapters.marinade.getYields(),
      this.adapters.mango.getYields(),
      this.adapters.funding.getYields(),
      this.adapters.pump.getYields(),
      this.adapters.orca.getYields(),
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
      try {
        const protocolPositions = await adapter.getPositions(wallet);
        positions.push(...protocolPositions);
      } catch (err) {
        // Continue with other protocols
      }
    }

    const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
    const weightedApy = totalValue > 0
      ? positions.reduce((sum, p) => sum + (p.currentApy * p.valueUsd), 0) / totalValue
      : 0;

    return { positions, totalValue, weightedApy };
  }
}
