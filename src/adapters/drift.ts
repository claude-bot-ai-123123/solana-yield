import { Connection, PublicKey } from '@solana/web3.js';
import { YieldOpportunity, Position } from '../types';

export class DriftAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getYields(): Promise<YieldOpportunity[]> {
    try {
      // Drift spot lending rates
      const response = await fetch('https://mainnet-beta.api.drift.trade/stats');
      const data = await response.json();
      
      const opportunities: YieldOpportunity[] = [];
      
      // Parse spot markets for lending yields
      if (data.spotMarkets) {
        for (const market of data.spotMarkets) {
          opportunities.push({
            protocol: 'drift',
            asset: market.symbol,
            apy: market.depositApy * 100 || 0,
            tvl: market.tvl || 0,
            risk: 'medium',
            metadata: { 
              marketIndex: market.marketIndex,
              type: 'lending'
            },
          });
        }
      }
      
      // Parse perp markets for funding rates (annualized)
      if (data.perpMarkets) {
        for (const market of data.perpMarkets) {
          const fundingRate = market.fundingRate || 0;
          // Funding rate is typically expressed as % per 8 hours
          // Annualize: fundingRate * 3 (per day) * 365
          const annualizedRate = fundingRate * 3 * 365;
          
          if (Math.abs(annualizedRate) > 0.1) { // Only show if > 0.1% APY
            opportunities.push({
              protocol: 'drift',
              asset: `${market.symbol}-PERP`,
              apy: annualizedRate,
              tvl: market.openInterest || 0,
              risk: 'high', // Perps are higher risk
              metadata: {
                marketIndex: market.marketIndex,
                type: 'funding',
                fundingRate8h: fundingRate,
                side: fundingRate > 0 ? 'short' : 'long', // Positive = shorts pay longs
              },
            });
          }
        }
      }
      
      return opportunities;
    } catch (err) {
      console.warn('Drift fetch failed, using fallback');
      return this.getFallbackYields();
    }
  }

  async getPositions(wallet: PublicKey): Promise<Position[]> {
    return [];
  }

  private getFallbackYields(): YieldOpportunity[] {
    return [
      { protocol: 'drift', asset: 'USDC', apy: 6.2, tvl: 40000000, risk: 'medium' },
      { protocol: 'drift', asset: 'SOL', apy: 4.8, tvl: 25000000, risk: 'medium' },
    ];
  }
}
